"use client";
import Link from "next/link";
import { useApi } from "../lib/api";

export function SupportContact() {
  const { data } = useApi<{ supportPhone: string; supportEmail: string }>(
    "/api/billing",
  );
  if (!data)
    return (
      <p>
        <Link href="/lien-he">Liên hệ hỗ trợ EP LAB</Link>
      </p>
    );
  return (
    <div className="support-contact">
      <p>
        <strong>Liên hệ admin EP LAB</strong>
      </p>
      {data.supportPhone && (
        <p>
          Điện thoại:{" "}
          <a href={`tel:${data.supportPhone}`}>{data.supportPhone}</a>
          {" · "}
          <a
            href={`https://zalo.me/${data.supportPhone}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Nhắn Zalo cho admin
          </a>
        </p>
      )}
      {data.supportEmail && (
        <p>
          Email: <a href={`mailto:${data.supportEmail}`}>{data.supportEmail}</a>
        </p>
      )}
    </div>
  );
}
