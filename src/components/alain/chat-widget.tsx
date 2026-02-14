"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  RotateCcw,
  Car,
  GitCompareArrows,
  Baby,
  Zap,
  Search,
  Package,
  Star,
  Shield,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useConversationStore,
  type Message,
} from "@/lib/alain/conversation-store";
import { generateSuggestions, type Suggestion } from "@/lib/alain/suggestions";
import { extractPreferences, mergePreferences } from "@/lib/alain/preference-extractor";

const SUGGESTION_ICONS: Record<Suggestion["icon"], React.ElementType> = {
  car: Car,
  compare: GitCompareArrows,
  family: Baby,
  ev: Zap,
  search: Search,
  trunk: Package,
  star: Star,
  shield: Shield,
  calculator: Calculator,
};

interface AlainChatWidgetProps {
  vehicleContext?: string;
}

export function AlainChatWidget({ vehicleContext }: AlainChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  // Conversation store
  const messages = useConversationStore((s) => s.messages);
  const context = useConversationStore((s) => s.context);
  const addMessage = useConversationStore((s) => s.addMessage);
  const clearMessages = useConversationStore((s) => s.clearMessages);
  const addToSearchHistory = useConversationStore((s) => s.addToSearchHistory);
  const addViewedVehicle = useConversationStore((s) => s.addViewedVehicle);

  // Track vehicle page visits
  useEffect(() => {
    if (pathname) {
      const vehiclePageMatch = pathname.match(
        /^\/marques\/[^/]+\/[^/]+\/[^/]+\/?$/
      );
      if (vehiclePageMatch) {
        addViewedVehicle(pathname);
      }
    }
  }, [pathname, addViewedVehicle]);

  // Generate contextual suggestions (with conversation context)
  const suggestions = useMemo(
    () => generateSuggestions(context, pathname ?? undefined, messages),
    [context, pathname, messages]
  );

  // Preference summary for display
  const prefBadges = useMemo(() => {
    const badges: { label: string; key: string }[] = [];
    const p = context.preferences;
    if (p.budget) badges.push({ label: `${Math.round(p.budget.max / 1000)}k\u20ac`, key: "budget" });
    if (p.childSeats) badges.push({ label: `${p.childSeats} enfant${p.childSeats > 1 ? "s" : ""}`, key: "children" });
    if (p.fuelTypes?.length) badges.push({ label: p.fuelTypes[0], key: "fuel" });
    if (p.priorities?.length) badges.push({ label: p.priorities[0], key: "priority" });
    if (p.usage?.length) badges.push({ label: p.usage[0], key: "usage" });
    return badges;
  }, [context.preferences]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userContent = text.trim();

    // Extract preferences from user message (regex, client-side, instant)
    const extracted = extractPreferences(userContent);
    if (Object.keys(extracted).length > 0) {
      const store = useConversationStore.getState();
      const merged = mergePreferences(store.context.preferences, extracted);
      store.updateContext({ preferences: merged });
    }

    // Add user message to store
    addMessage({ role: "user", content: userContent });
    addToSearchHistory(userContent);

    setInput("");
    setLoading(true);

    try {
      const store = useConversationStore.getState();
      const apiMessages = store.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const prefs = store.context.preferences;
      const hasPrefs = prefs.budget || prefs.fuelTypes?.length || prefs.childSeats || prefs.priorities?.length || prefs.usage?.length;

      const res = await fetch("/api/alain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          vehicleContext,
          ...(hasPrefs ? { preferences: prefs } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok && res.status === 503) {
        addMessage({
          role: "assistant",
          content:
            "ALAIN est en pause. Relance le serveur local ou verifie la cle API.",
        });
      } else if (data.error) {
        addMessage({
          role: "assistant",
          content:
            data.error === "ANTHROPIC_API_KEY not configured"
              ? "Je suis temporairement indisponible. La cle API n'est pas configuree."
              : `Erreur : ${data.error}`,
        });
      } else {
        addMessage({
          role: "assistant",
          content: data.message,
        });
      }
    } catch {
      addMessage({
        role: "assistant",
        content: "Oups, probleme de connexion. Reessaye dans un instant.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resetChat = () => {
    clearMessages();
    setInput("");
  };

  const messageCount = messages.length;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-105 active:scale-95"
            aria-label="Ouvrir ALAIN"
          >
            <MessageCircle className="h-6 w-6" />
            {/* Conversation memory indicator */}
            {messageCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {messageCount > 99 ? "99+" : messageCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-0 right-0 z-50 flex h-dvh w-full flex-col overflow-hidden border-[var(--border-subtle)] surface-1 shadow-2xl sm:bottom-6 sm:right-6 sm:h-[min(600px,calc(100vh-3rem))] sm:w-[min(420px,calc(100vw-3rem))] sm:rounded-2xl sm:border"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 surface-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-white">ALAIN</p>
                  <p className="text-[10px] text-muted-foreground">
                    Assistant auto IA
                    {messageCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                        {messageCount} msg
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={resetChat}
                  className="rounded-lg p-1.5 text-muted-foreground hover:surface-3 hover:text-white"
                  aria-label="Nouveau chat"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:surface-3 hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Preference badges */}
            {prefBadges.length > 0 && (
              <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] px-3 py-1.5">
                {prefBadges.map((b) => (
                  <span
                    key={b.key}
                    className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {b.label}
                  </span>
                ))}
                <button
                  onClick={() => useConversationStore.getState().updateContext({ preferences: {} })}
                  className="ml-auto text-[10px] text-muted-foreground hover:text-white"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Messages area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 ? (
                <WelcomeScreen
                  suggestions={suggestions}
                  onSuggestion={sendMessage}
                />
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} />
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      ALAIN reflechit...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Suggestion chips (shown when there are messages but not loading) */}
            {messages.length > 0 && !loading && suggestions.length > 0 && (
              <div className="border-t border-[var(--border-subtle)] px-3 py-2">
                <div className="flex flex-nowrap gap-1.5 overflow-x-auto">
                  {suggestions.slice(0, 3).map((s) => {
                    const Icon = SUGGESTION_ICONS[s.icon];
                    return (
                      <button
                        key={s.text}
                        onClick={() => sendMessage(s.action)}
                        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] text-muted-foreground transition hover:surface-3 hover:text-white"
                      >
                        <Icon className="h-3 w-3" />
                        {s.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-[var(--border-subtle)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pose ta question..."
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-[var(--border-subtle)] surface-2 px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground focus:border-primary"
                  disabled={loading}
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="h-9 w-9 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function WelcomeScreen({
  suggestions,
  onSuggestion,
}: {
  suggestions: Suggestion[];
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <Sparkles className="h-10 w-10 text-primary/60" />
      <h3 className="mt-3 font-display text-sm font-semibold text-white">Salut ! Je suis ALAIN</h3>
      <p className="mt-1 max-w-70 text-xs text-muted-foreground">
        Ton assistant auto. Pose-moi une question sur un vehicule, ou essaie une
        suggestion :
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => {
          const Icon = SUGGESTION_ICONS[s.icon];
          return (
            <button
              key={s.text}
              onClick={() => onSuggestion(s.action)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] px-3 py-1.5 text-xs transition hover:surface-3 hover:text-white"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {s.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "surface-3 text-white"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
          />
        )}
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  let html = text
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 text-[11px] font-mono">$1</code>')
    // Bold + italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline hover:text-primary/80" target="_blank" rel="noopener">$1</a>')
    // Tables (simple: | col | col |)
    .replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm, (_match, header: string, _sep: string, body: string) => {
      const thCells = header.split("|").filter(Boolean).map((c: string) => `<th class="px-2 py-1 text-left text-[11px] font-semibold">${c.trim()}</th>`).join("");
      const rows = body.trim().split("\n").map((row: string) => {
        const cells = row.split("|").filter(Boolean).map((c: string) => `<td class="px-2 py-1 text-[11px]">${c.trim()}</td>`).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table class="w-full border-collapse my-1"><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    // List items
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul class="list-disc pl-4 space-y-0.5">${m}</ul>`)
    // Paragraphs
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap in paragraph if not starting with block element
  if (!html.startsWith("<")) html = `<p>${html}</p>`;
  else if (!html.startsWith("<p>") && !html.startsWith("<ul") && !html.startsWith("<table")) html = `<p>${html}</p>`;

  return html;
}
