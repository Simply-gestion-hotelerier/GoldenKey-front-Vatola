// src/hooks/useSSENotifications.ts
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/rbac";

export type SSENotificationEvent =
  | "payment"
  | "order_created"
  | "order_closed"
  | "order_line_status"
  | "checkin"
  | "checkout"
  | "low_stock"
  | "info";

const EVENT_ICONS: Record<SSENotificationEvent | string, string> = {
  payment:           "💳",
  order_created:     "🍽️",
  order_closed:      "✅",
  order_line_status: "🔔",
  checkin:           "🏨",
  checkout:          "🚪",
  low_stock:         "⚠️",
  info:              "ℹ️",
};

const QUERY_INVALIDATIONS: Partial<Record<SSENotificationEvent, string[][]>> = {
  payment:           [["orders", "restaurant"], ["hotel", "reservations"], ["notifications"]],
  order_created:     [["orders"], ["notifications"]],
  order_closed:      [["orders"], ["notifications"]],
  order_line_status: [["orders"], ["notifications"]],
  checkin:           [["hotel", "reservations"], ["notifications"]],
  checkout:          [["hotel", "reservations"], ["notifications"]],
  low_stock:         [["inventory"], ["notifications"]],
  info:              [["notifications"]],
};

const ALL_EVENTS: SSENotificationEvent[] = [
  "payment",
  "order_created",
  "order_closed",
  "order_line_status",
  "checkin",
  "checkout",
  "low_stock",
  "info",
];

// ✅ URL absolue vers le backend (port 4000)
const BACKEND_URL = "http://localhost:4000";

function getReconnectDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 30_000);
}

export function useSSENotifications() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  const handleEvent = useCallback(
    (eventName: string, data: any) => {
      const icon = EVENT_ICONS[eventName] ?? "🔔";

      toast({
        title: `${icon} ${data.title ?? eventName}`,
        description: data.body ?? undefined,
        duration: 5000,
      });

      const keys =
        QUERY_INVALIDATIONS[eventName as SSENotificationEvent] ?? [["notifications"]];
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    },
    [qc]
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    // ✅ URL absolue — évite que le browser cherche /sse/stream sur le port du frontend
    const url = `${BACKEND_URL}/sse/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", () => {
      attemptRef.current = 0;
    });

    ALL_EVENTS.forEach((evt) => {
      es.addEventListener(evt, (e: MessageEvent) => {
        try {
          handleEvent(evt, JSON.parse(e.data));
        } catch {
          // JSON malformé — ignorer
          console.error("Erreur lors du parsing d'une notification SSE", e.data);
        }
      });
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;

      if (!mountedRef.current) return;

      const delay = getReconnectDelay(attemptRef.current);
      attemptRef.current += 1;

      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, [handleEvent]);

  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthenticated) return;

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [isAuthenticated, connect]);
}