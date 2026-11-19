"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, useApi, date } from "../lib/api";
import { useAuth } from "./context";
import { usePracticeTrack } from "./practice-track";
import { PracticeNav } from "./practice-nav";
import { Loading, ErrorBox, Empty, Notice, PageTitle } from "./ui";
export function PracticeConversations({ host = false }: { host?: boolean }) {
  const track = usePracticeTrack(),
    { user, loading: authLoading } = useAuth(),
    params = useSearchParams();
  const [exerciseId, setExerciseId] = useState(params.get("exercise") || ""),
    [creationId, setCreationId] = useState(() => crypto.randomUUID());
  const [page, setPage] = useState(0),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const list = useApi(user ? `${track.api}/conversations?page=${page}` : null),
    exercises = useApi<any[]>(user ? `${track.api}/exercises` : null);
  const isHost = host && user?.role === "admin";
  if (authLoading) return <Loading />;
  if (!user)
    return (
      <Empty
        title="Đăng nhập để trao đổi"
        description="Trao đổi riêng giữa người tham gia và hai người chủ trì, theo từng bài tập."
        href="/dang-nhap"
        label="Đăng nhập"
      />
    );
  return (
    <section className="practice-conversations">
      {!host && (
        <>
          <PageTitle
            eyebrow={`${track.label} · HỎI ĐÁP`}
            title="Trao đổi với người chủ trì"
            description="Hỏi trước khi làm bài, bổ sung thông tin và trao đổi về nhận xét. Mỗi bài có một cuộc trao đổi riêng của bạn."
          />
          <PracticeNav />
        </>
      )}
      <p className="practice-note">
        Chỉ người tham gia trong cuộc trao đổi và hai người chủ trì được xem.
        Nhấn Làm mới để nhận tin mới.
      </p>
      {!isHost && (
        <form
          className="panel stack conversation-create"
          onChange={() => setCreationId(crypto.randomUUID())}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = e.currentTarget,
              f = new FormData(form);
            try {
              const r = await api(`${track.api}/conversations`, "POST", {
                exerciseId: f.get("exercise"),
                subject: f.get("subject"),
                body: f.get("body"),
                clientId: creationId,
              });
              setSelected(r.id);
              setCreationId(crypto.randomUUID());
              form.reset();
              await list.reload();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Gửi câu hỏi về bài tập</h2>
          <label>
            Bài cần trao đổi
            <select
              aria-label="Bài cần trao đổi"
              name="exercise"
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              required
            >
              <option value="" disabled>
                Chọn bài tập
              </option>
              {exercises.data?.map((e) => (
                <option value={e.id} key={e.id}>
                  {e.id.toUpperCase()} · {e.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chủ đề
            <input name="subject" minLength={3} maxLength={160} required />
          </label>
          <label>
            Câu hỏi
            <textarea name="body" rows={4} maxLength={3000} required />
          </label>
          <p>
            Nếu đã có cuộc trao đổi cho bài này, câu hỏi được thêm vào cuộc đó.
          </p>
          <button
            className="btn primary"
            disabled={busy || !user.active || !exercises.data?.length}
          >
            {busy ? "Đang gửi…" : "Gửi câu hỏi"}
          </button>
          {!user.active && <p>Cần được duyệt tham gia Lab quyền học để gửi câu hỏi mới.</p>}
        </form>
      )}
      {error && <Notice type="error">{error}</Notice>}
      <div className="conversation-layout">
        <aside className="panel conversation-list">
          <h2>
            {isHost ? "Trao đổi của người tham gia" : "Cuộc trao đổi của tôi"}
          </h2>
          <button className="btn secondary" onClick={list.reload}>
            Làm mới danh sách trao đổi
          </button>
          {list.loading ? (
            <Loading />
          ) : list.error ? (
            <ErrorBox message={list.error} retry={list.reload} />
          ) : (
            <>
              {!list.data?.items.length && <p>Chưa có cuộc trao đổi.</p>}
              {list.data?.items.map((t: any) => (
                <button
                  type="button"
                  className={`conversation-item ${selected === t.id ? "selected" : ""}`}
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                >
                  <b>{t.subject}</b>
                  <span>
                    {t.exercise_id.toUpperCase()} ·{" "}
                    {isHost ? t.participant_name : track.label}
                  </span>
                  <span className="badge">
                    {t.resolved
                      ? "Đã giải đáp"
                      : t.waiting_for === "host"
                        ? "Chờ người chủ trì"
                        : "Người chủ trì đã trả lời"}
                  </span>
                  <span>{t.last_message}</span>
                  <small>{date(t.updated_at)}</small>
                </button>
              ))}
              <div className="button-row">
                <button
                  className="btn secondary"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Trước
                </button>
                <span>Trang {page + 1}</span>
                <button
                  className="btn secondary"
                  disabled={!list.data?.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Sau
                </button>
              </div>
            </>
          )}
        </aside>
        {selected ? (
          <ConversationThread
            key={selected}
            id={selected}
            host={!!isHost}
            changed={list.reload}
          />
        ) : (
          <section className="panel empty">
            <h2>Chọn cuộc trao đổi</h2>
            <p>Câu hỏi, câu trả lời và thời gian gửi được lưu theo từng bài.</p>
          </section>
        )}
      </div>
    </section>
  );
}
function ConversationThread({
  id,
  host,
  changed,
}: {
  id: string;
  host: boolean;
  changed: () => Promise<void>;
}) {
  const track = usePracticeTrack(),
    { user } = useAuth(),
    detail = useApi(`${track.api}/conversations/${id}`);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState(""),
    [nonce, setNonce] = useState(() => crypto.randomUUID());
  async function reload() {
    await detail.reload();
    await changed();
  }
  if (detail.loading && !detail.data) return <Loading />;
  if (detail.error)
    return <ErrorBox message={detail.error} retry={detail.reload} />;
  const d = detail.data;
  if (!d) return null;
  return (
    <section className="panel stack conversation-thread">
      <h2>{d.thread.subject}</h2>
      <p>
        {d.thread.participant_name} · {d.thread.exercise_title}
      </p>
      <Link href={`${track.base}/thuc-hanh/${d.thread.exercise_id}`}>
        Mở đề bài →
      </Link>
      <div className="button-row">
        <button className="btn secondary" disabled={busy} onClick={reload}>
          Làm mới tin nhắn
        </button>
        {(host || d.thread.resolved) && (
          <button
            className="btn secondary"
            disabled={busy || !user?.active}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api(`${track.api}/conversations/${id}`, "PATCH", {
                  resolved: !d.thread.resolved,
                });
                await reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {d.thread.resolved ? "Tiếp tục trao đổi" : "Đánh dấu đã giải đáp"}
          </button>
        )}
      </div>
      {d.hasOlder && (
        <button
          className="btn secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const older = await api(
                `${track.api}/conversations/${id}?before=${d.nextBefore}`,
              );
              detail.setData({
                ...d,
                messages: [...older.messages, ...d.messages],
                hasOlder: older.hasOlder,
                nextBefore: older.nextBefore,
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Xem tin nhắn cũ hơn
        </button>
      )}
      <div className="conversation-messages" aria-label="Nội dung trao đổi">
        {d.messages.map((m: any) => (
          <article
            className={`conversation-message ${m.author_role === "Người chủ trì" ? "host" : "participant"}`}
            key={m.id}
          >
            <div>
              <strong>{m.author_role}</strong>
              <span>
                {m.author_name} · {date(m.created_at)}
              </span>
            </div>
            <p className="preserve">{m.body}</p>
          </article>
        ))}
      </div>
      {d.thread.resolved && (
        <Notice type="success">Cuộc trao đổi đã được giải đáp.</Notice>
      )}
      <form
        className="stack conversation-reply"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`${track.api}/conversations/${id}/messages`, "POST", {
              body,
              clientId: nonce,
            });
            setBody("");
            setNonce(crypto.randomUUID());
            await reload();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {host ? "Trả lời người tham gia" : "Tin nhắn cho người chủ trì"}
          <textarea
            aria-label="Nội dung tin nhắn"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setNonce(crypto.randomUUID());
            }}
            maxLength={3000}
            rows={4}
            required
          />
        </label>
        <button
          className="btn primary"
          disabled={busy || d.thread.resolved || !user?.active}
        >
          {busy ? "Đang gửi…" : "Gửi tin nhắn"}
        </button>
      </form>
      {error && <Notice type="error">{error}</Notice>}
    </section>
  );
}
