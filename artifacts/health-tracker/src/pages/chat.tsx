import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  useListConversations,
  useCreateConversation,
  useGetConversation,
  getListConversationsQueryKey,
  getGetConversationQueryKey,
  getTesterId,
} from "@workspace/api-client-react";
import { useVoiceRecorder, useVoiceStream } from "@workspace/integrations-openai-ai-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, MicOff, Send, Plus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL;
const WORKLET_PATH = BASE + "audio-playback-worklet.js";

export default function Chat() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading } = useListConversations();
  const { data: conversation, isLoading: convLoading } = useGetConversation(
    activeId!,
    { query: { enabled: !!activeId, queryKey: getGetConversationQueryKey(activeId!) } }
  );
  const createConversation = useCreateConversation();

  const voiceRecorder = useVoiceRecorder();
  const voiceStream = useVoiceStream({
    workletPath: WORKLET_PATH,
    onTranscript: (_chunk, full) => setStreamedContent(full),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, streamedContent]);

  const handleNewConversation = () => {
    createConversation.mutate(
      { data: { title: "Health session" } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setActiveId(conv.id);
        },
      }
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeId || streaming) return;
    const message = input;
    setInput("");
    setStreaming(true);
    setStreamedContent("");

    try {
      const testerId = getTesterId();
      const response = await fetch(`/api/openai/conversations/${activeId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(testerId ? { "x-tester-id": testerId } : {}),
        },
        body: JSON.stringify({ content: message }),
      });
      if (!response.body) throw new Error("No stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.content) setStreamedContent((prev) => prev + data.content);
          if (data.done) {
            queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(activeId) });
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          }
        }
      }
    } catch (err) {
      toast({ title: "Send failed", variant: "destructive" });
    } finally {
      setStreaming(false);
      setStreamedContent("");
    }
  };

  const handleVoiceToggle = useCallback(async () => {
    if (!activeId) {
      toast({ title: "Start a conversation first", variant: "destructive" });
      return;
    }
    if (isRecording) {
      setIsRecording(false);
      const blob = await voiceRecorder.stopRecording();
      if (!blob) return;
      setStreaming(true);
      setStreamedContent("");
      try {
        const tid = getTesterId();
        const voiceUrl = `/api/openai/conversations/${activeId}/voice-messages${tid ? `?testerId=${encodeURIComponent(tid)}` : ""}`;
        await voiceStream.streamVoiceResponse(voiceUrl, blob);
        queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(activeId) });
      } catch (err) {
        toast({ title: "Voice failed", variant: "destructive" });
      } finally {
        setStreaming(false);
        setStreamedContent("");
      }
    } else {
      setIsRecording(true);
      await voiceRecorder.startRecording();
    }
  }, [isRecording, activeId, voiceRecorder, voiceStream, queryClient, toast]);

  const messages = conversation?.messages ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar: conversations */}
      <div className="w-52 flex-shrink-0 border-r border-border/40 bg-card/20 flex flex-col">
        <div className="p-4 border-b border-border/30">
          <Button size="sm" className="w-full gap-2 text-xs" onClick={handleNewConversation} disabled={createConversation.isPending}>
            {createConversation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            New Session
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {convsLoading ? (
            <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
          ) : !conversations?.length ? (
            <p className="text-xs text-muted-foreground p-3 text-center">No sessions yet</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`text-left w-full px-3 py-2.5 rounded-lg text-xs transition-all ${
                  activeId === c.id
                    ? "bg-primary/15 text-foreground border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/30 border border-transparent"
                }`}
              >
                <p className="font-medium truncate">{c.title || "Session"}</p>
                <p className="text-muted-foreground/50 mt-0.5">{format(new Date(c.createdAt), "MMM d, h:mm a")}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-serif text-foreground">Oracle</h2>
              <p className="text-muted-foreground mt-2 max-w-sm leading-relaxed">
                Your AI wellness guide — aware of your health history and the current astrological moment. Speak or type anything.
              </p>
            </div>
            <Button onClick={handleNewConversation} disabled={createConversation.isPending} className="gap-2">
              {createConversation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Start a session
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {convLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : messages.length === 0 && !streaming ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground/60 text-sm">Session started. Say anything — your symptoms, what you took, how you're feeling.</p>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary/20 text-foreground border border-primary/20 rounded-tr-sm"
                          : "bg-card/60 text-foreground border border-border/40 rounded-tl-sm backdrop-blur-sm"
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs text-muted-foreground/40 mt-1.5">{format(new Date(msg.createdAt), "h:mm a")}</p>
                      </div>
                    </div>
                  ))}
                  {(streaming || streamedContent) && (
                    <div className="flex justify-start">
                      <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-card/60 border border-border/40 backdrop-blur-sm">
                        {streamedContent ? (
                          <p className="whitespace-pre-wrap">{streamedContent}<span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle" /></p>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground/60">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Thinking...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-border/30 p-4 bg-background/50 backdrop-blur-md">
              <form onSubmit={handleSend} className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="How are you feeling? What did you take today?"
                  disabled={streaming || isRecording}
                  className="flex-1 min-h-[44px] max-h-32 bg-card/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e as any);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  disabled={streaming}
                  className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all border ${
                    isRecording
                      ? "bg-destructive/20 border-destructive/40 text-destructive animate-pulse"
                      : "bg-secondary/20 border-secondary/30 text-secondary-foreground hover:bg-secondary/30"
                  } disabled:opacity-40`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <Button type="submit" size="icon" disabled={!input.trim() || streaming || isRecording} className="w-11 h-11 rounded-xl flex-shrink-0">
                  {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
              {isRecording && (
                <p className="text-xs text-destructive/70 mt-2 text-center animate-pulse">Recording... tap mic to stop</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
