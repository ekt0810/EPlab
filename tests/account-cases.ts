import assert from "node:assert/strict";
export async function accountCases(
  t: any,
  {
    call,
    admin,
    student,
    other,
    pool,
    findToken,
    pass,
    paidLesson,
    config,
  }: any,
) {
  let id: string, invited: any, active: any, order: any;
  const email = "managed-account@example.test";
  const body = {
    name: "Học viên được cấp",
    phone: "0900000003",
    email,
    note: "Tạo hồ sơ cho lớp thử nghiệm.",
  };
  function safe(value: any) {
    const s = JSON.stringify(value);
    for (const key of [
      "password_hash",
      "mfa_secret",
      "recovery_hashes",
      "csrf",
      "session_id",
      "mfa_pending",
    ])
      assert.ok(!s.includes('"' + key + '"'), key);
    assert.ok(!s.includes(pass));
    assert.ok(!s.includes("#token="));
  }
  await t.test(
    "account management denies guests and learners, including strict role escalation",
    async () => {
      for (const session of [undefined, student, other]) {
        const code = session ? 403 : 401;
        assert.equal(
          (await call("GET", "/api/admin/accounts", undefined, session))
            .statusCode,
          code,
        );
        assert.equal(
          (await call("POST", "/api/admin/accounts", body, session)).statusCode,
          code,
        );
      }
      assert.equal(
        (
          await call(
            "POST",
            "/api/admin/accounts",
            { ...body, role: "admin" },
            admin,
          )
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await call(
            "POST",
            "/api/admin/accounts",
            { ...body, active: true },
            admin,
          )
        ).statusCode,
        400,
      );
    },
  );
  await t.test(
    "admin creates an invited learner with no paid access and no returned credentials",
    async () => {
      const r = await call("POST", "/api/admin/accounts", body, admin);
      assert.equal(r.statusCode, 201, r.body);
      id = r.json().id;
      assert.equal(r.json().invitationSent, true);
      safe(r.json());
      assert.equal(
        (await call("POST", "/api/admin/accounts", body, admin)).statusCode,
        409,
      );
      const profile = (
        await call("GET", `/api/admin/accounts/${id}`, undefined, admin)
      ).json();
      safe(profile);
      assert.equal(profile.user.role, "student");
      assert.equal(profile.user.verified, false);
      assert.equal(profile.user.setup_pending, true);
      assert.equal(profile.user.active, false);
      assert.ok(profile.creator.email);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM users WHERE role='admin'",
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (await call("GET", `/api/admin/accounts/${id}`, undefined, student))
          .statusCode,
        403,
      );
      assert.equal(
        (
          await call(
            "GET",
            `/api/admin/accounts/${id}/history`,
            undefined,
            student,
          )
        ).statusCode,
        403,
      );
    },
  );
  await t.test(
    "invitation reissue invalidates old link; acceptance requires consent, verifies email once and never grants paid access",
    async () => {
      const old = await findToken(email);
      assert.equal(
        (
          await call(
            "POST",
            `/api/admin/accounts/${id}/email`,
            { purpose: "invite" },
            admin,
          )
        ).statusCode,
        200,
      );
      const fresh = await findToken(email);
      assert.notEqual(old, fresh);
      assert.equal(
        (
          await call("POST", "/api/auth/accept-invitation", {
            token: old,
            password: pass,
            acceptedTerms: true,
          })
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await call("POST", "/api/auth/accept-invitation", {
            token: fresh,
            password: pass,
            acceptedTerms: false,
          })
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await call("POST", "/api/auth/accept-invitation", {
            token: fresh,
            password: pass,
            acceptedTerms: true,
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (
          await call("POST", "/api/auth/accept-invitation", {
            token: fresh,
            password: pass,
            acceptedTerms: true,
          })
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await call("POST", "/api/auth/login", {
            email,
            password: "wrong-test-password",
          })
        ).statusCode,
        401,
      );
      const logged = await call("POST", "/api/auth/login", {
        email,
        password: pass,
      });
      assert.equal(logged.statusCode, 200, logged.body);
      invited = {
        cookie: logged.cookies
          .map((c: any) => `${c.name}=${c.value}`)
          .join("; "),
        csrf: logged.json().csrf,
      };
      const me = (await call("GET", "/api/auth/me", undefined, invited)).json();
      assert.equal(me.user.verified, true);
      assert.equal(me.user.active, false);
      assert.equal(
        (
          await call(
            "GET",
            `/api/lessons/${paidLesson.slug}`,
            undefined,
            invited,
          )
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await call(
            "POST",
            `/api/admin/accounts/${id}/email`,
            { purpose: "invite" },
            admin,
          )
        ).statusCode,
        409,
      );
    },
  );
  await t.test(
    "expired and blocked invitations cannot claim an account; failed email keeps a recoverable unprivileged profile",
    async () => {
      const r = await call(
        "POST",
        "/api/admin/accounts",
        { ...body, email: "expired-invite@example.test" },
        admin,
      );
      assert.equal(r.statusCode, 201, r.body);
      const x = r.json().id;
      const raw = await findToken("expired-invite@example.test");
      await pool.query(
        "UPDATE tokens SET expires_at=now()-interval '1 minute' WHERE user_id=$1",
        [x],
      );
      assert.equal(
        (
          await call("POST", "/api/auth/accept-invitation", {
            token: raw,
            password: pass,
            acceptedTerms: true,
          })
        ).statusCode,
        400,
      );
      await call(
        "POST",
        `/api/admin/accounts/${x}/email`,
        { purpose: "invite" },
        admin,
      );
      const blocked = await findToken("expired-invite@example.test");
      await call(
        "PATCH",
        `/api/admin/users/${x}`,
        { blocked: true, reason: "Khóa hồ sơ thử nghiệm." },
        admin,
      );
      assert.equal(
        (
          await call("POST", "/api/auth/accept-invitation", {
            token: blocked,
            password: pass,
            acceptedTerms: true,
          })
        ).statusCode,
        400,
      );
      const oldMode = config.mailMode;
      config.mailMode = "disabled";
      try {
        const fail = await call(
          "POST",
          "/api/admin/accounts",
          { ...body, email: "unsent-invite@example.test" },
          admin,
        );
        assert.equal(fail.statusCode, 201, fail.body);
        assert.equal(fail.json().invitationSent, false);
        const detail = (
          await call(
            "GET",
            `/api/admin/accounts/${fail.json().id}`,
            undefined,
            admin,
          )
        ).json();
        assert.equal(detail.user.active, false);
        assert.equal(detail.user.verified, false);
        const history = (
          await call(
            "GET",
            `/api/admin/accounts/${fail.json().id}/history`,
            undefined,
            admin,
          )
        ).json();
        assert.ok(
          history.items.some((a: any) => a.action === "user.email_failed"),
        );
        safe(history);
      } finally {
        config.mailMode = oldMode;
      }
    },
  );
  await t.test(
    "admin-created orders reuse pending order and only verified matching payments grant learning access",
    async () => {
      const r = await call(
        "POST",
        `/api/admin/accounts/${id}/orders`,
        {},
        admin,
      );
      assert.equal(r.statusCode, 200, r.body);
      order = r.json();
      assert.equal(order.amount, 150000);
      const repeat = await call(
        "POST",
        `/api/admin/accounts/${id}/orders`,
        {},
        admin,
      );
      assert.equal(repeat.json().id, order.id);
      assert.equal(
        (await call("POST", `/api/admin/accounts/${id}/orders`, {}, invited))
          .statusCode,
        403,
      );
      const payment = {
        reference: "MANAGED-ACCOUNT-TEST-001",
        amount: order.amount,
        accountNumber: order.bank_snapshot.accountNumber,
        note: "Đối soát dữ liệu thử nghiệm.",
        confirmed: true,
      };
      assert.equal(
        (
          await call(
            "POST",
            `/api/admin/orders/${order.id}/approve`,
            { ...payment, amount: 1 },
            admin,
          )
        ).statusCode,
        409,
      );
      assert.equal(
        (await call("GET", "/api/auth/me", undefined, invited)).json().user
          .active,
        false,
      );
      const approved = await call(
        "POST",
        `/api/admin/orders/${order.id}/approve`,
        payment,
        admin,
      );
      assert.equal(approved.statusCode, 200, approved.body);
      assert.equal(
        (
          await call(
            "POST",
            `/api/admin/orders/${order.id}/approve`,
            payment,
            admin,
          )
        ).json().duplicate,
        true,
      );
      active = invited;
      assert.equal(
        (await call("GET", "/api/auth/me", undefined, active)).json().user
          .active,
        true,
      );
      assert.equal(
        (
          await call(
            "GET",
            `/api/lessons/${paidLesson.slug}`,
            undefined,
            active,
          )
        ).statusCode,
        200,
      );
      assert.equal(
        (await call("POST", `/api/admin/accounts/${id}/orders`, {}, admin))
          .statusCode,
        409,
      );
      const paymentHistory = (
        await call(
          "GET",
          `/api/admin/accounts/${id}/history?kind=payment`,
          undefined,
          admin,
        )
      ).json();
      assert.equal(
        paymentHistory.items.filter((a: any) => a.action === "payment.approved")
          .length,
        1,
      );
      assert.ok(
        paymentHistory.items.some((a: any) => a.action === "order.created"),
      );
    },
  );
  await t.test(
    "blocking and revoking sessions take immediate effect while preserving paid entitlement and immutable history",
    async () => {
      const blocked = await call(
        "PATCH",
        `/api/admin/users/${id}`,
        { blocked: true, reason: "Tạm khóa để kiểm tra tài khoản." },
        admin,
      );
      assert.equal(blocked.statusCode, 200, blocked.body);
      assert.equal(
        (await call("GET", "/api/auth/me", undefined, active)).json().user,
        null,
      );
      const detail = (
        await call("GET", `/api/admin/accounts/${id}`, undefined, admin)
      ).json();
      assert.equal(detail.user.active, true);
      assert.equal(detail.sessions.length, 0);
      await call(
        "PATCH",
        `/api/admin/users/${id}`,
        { blocked: false, reason: "Đã hoàn tất kiểm tra." },
        admin,
      );
      const r = await call("POST", "/api/auth/login", {
        email,
        password: pass,
      });
      assert.equal(r.statusCode, 200, r.body);
      active = {
        cookie: r.cookies.map((c: any) => `${c.name}=${c.value}`).join("; "),
        csrf: r.json().csrf,
      };
      assert.equal(
        (
          await call(
            "POST",
            `/api/admin/accounts/${id}/revoke-sessions`,
            { reason: "Thu hồi phiên thử nghiệm." },
            admin,
          )
        ).statusCode,
        200,
      );
      assert.equal(
        (await call("GET", "/api/auth/me", undefined, active)).json().user,
        null,
      );
      const history = (
        await call("GET", `/api/admin/accounts/${id}/history`, undefined, admin)
      ).json();
      for (const action of [
        "user.created",
        "user.invite_sent",
        "user.invitation_accepted",
        "login",
        "login.failed",
        "user.blocked",
        "user.unblocked",
        "sessions.revoked",
      ])
        assert.ok(
          history.items.some((a: any) => a.action === action),
          action,
        );
      safe(history);
    },
  );
  await t.test(
    "both admin accounts are protected and lists, notes, filters and history paginate without secrets",
    async () => {
      const admins = (
        await call("GET", "/api/admin/accounts?role=admin", undefined, admin)
      ).json();
      assert.equal(admins.total, 2);
      safe(admins);
      for (const u of admins.items) {
        assert.equal(
          (
            await call(
              "PATCH",
              `/api/admin/users/${u.id}`,
              { blocked: true, reason: "Forbidden test action." },
              admin,
            )
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await call(
              "POST",
              `/api/admin/accounts/${u.id}/email`,
              { purpose: "reset" },
              admin,
            )
          ).statusCode,
          403,
        );
        assert.equal(
          (await call("POST", `/api/admin/accounts/${u.id}/orders`, {}, admin))
            .statusCode,
          403,
        );
      }
      for (let i = 0; i < 3; i++)
        assert.equal(
          (
            await call(
              "POST",
              `/api/admin/accounts/${id}/notes`,
              { note: "Ghi chú kiểm thử " + i },
              admin,
            )
          ).statusCode,
          200,
        );
      const list = (
        await call(
          "GET",
          "/api/admin/accounts?q=MANAGED-ACCOUNT&state=active",
          undefined,
          admin,
        )
      ).json();
      assert.equal(list.total, 1);
      assert.equal(list.items[0].id, id);
      safe(list);
      const p1 = (
          await call(
            "GET",
            `/api/admin/accounts/${id}/history?kind=account&limit=2&page=1`,
            undefined,
            admin,
          )
        ).json(),
        p2 = (
          await call(
            "GET",
            `/api/admin/accounts/${id}/history?kind=account&limit=2&page=2`,
            undefined,
            admin,
          )
        ).json();
      assert.equal(p1.items.length, 2);
      assert.ok(p1.total > 2);
      assert.ok(
        !p1.items.some((a: any) => p2.items.some((b: any) => a.id === b.id)),
      );
      safe(p1);
      assert.equal(
        (await call("GET", "/api/admin/accounts?page=-1", undefined, admin))
          .statusCode,
        400,
      );
      assert.equal(
        (
          await call(
            "GET",
            `/api/admin/accounts/${id}/history?kind=invalid`,
            undefined,
            admin,
          )
        ).statusCode,
        400,
      );
      assert.equal(
        (await call("DELETE", `/api/admin/accounts/${id}/history`, {}, admin))
          .statusCode,
        404,
      );
    },
  );
}
