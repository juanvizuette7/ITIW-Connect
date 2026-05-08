"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type JobDetail = {
  id: string;
  request: {
    id: string;
    description: string;
  };
};

type ProfileMeResponse = {
  id: string;
  name: string;
};

type MessageItem = {
  id: string;
  requestId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    role: "CLIENTE" | "PROFESIONAL";
    name: string;
  };
};

export default function JobChatPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [requestId, setRequestId] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadMessages(authToken: string, currentRequestId: string) {
    const items = await apiRequest<MessageItem[]>(`/messages/${currentRequestId}`, {
      method: "GET",
      token: authToken,
    });
    setMessages(items);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  useEffect(() => {
    async function init() {
      const authToken = getToken();
      if (!authToken) {
        router.replace("/auth/login");
        return;
      }

      setToken(authToken);

      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", {
          method: "GET",
          token: authToken,
        });

        const job = await apiRequest<JobDetail>(`/jobs/${params.jobId}`, {
          method: "GET",
          token: authToken,
        });

        setUserId(profile.id);
        setUserName(profile.name);
        setRequestId(job.request.id);
        await loadMessages(authToken, job.request.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el chat.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [params.jobId, router]);

  useEffect(() => {
    if (!token || !requestId) return;

    const interval = setInterval(() => {
      void loadMessages(token, requestId);
    }, 5000);

    return () => clearInterval(interval);
  }, [token, requestId]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!token || !requestId || !content.trim()) return;

    setSending(true);
    setError(null);

    try {
      await apiRequest<MessageItem>(`/messages/${requestId}`, {
        method: "POST",
        token,
        body: JSON.stringify({ content }),
      });

      setContent("");
      await loadMessages(token, requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando chat...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel flex h-[72vh] flex-col overflow-hidden p-0">
        <header className="border-b border-white/10 px-5 py-4">
          <h1 className="font-[var(--font-heading)] text-2xl font-bold text-white">Chat del job</h1>
        </header>

        {error && <p className="premium-error mx-5 mt-4">{error}</p>}

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((message) => {
            const own = message.sender.id === userId;
            return (
              <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    own
                      ? "bg-[#14b8a6] text-white"
                      : "border border-white/10 bg-[#0f3460] text-[#d5dded]"
                  }`}
                >
                  <p className="mb-1 text-xs opacity-80">{message.sender.name}</p>
                  <p>{message.content}</p>
                  <p className="mt-2 text-[11px] opacity-70">
                    {new Date(message.createdAt).toLocaleString("es-CO")}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSend} className="border-t border-white/10 p-4">
          <div className="flex gap-3">
            <input
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="premium-input"
              placeholder="Escribe tu mensaje..."
            />
            <button disabled={sending} className="premium-btn-primary px-5">
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
