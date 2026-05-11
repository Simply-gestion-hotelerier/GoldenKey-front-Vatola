// src/pages/notifications/Notifications.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function Notifications() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Array<{ id: number; title: string; body?: string | null; read: boolean; createdAt: string }>>([]);

  async function load() {
    try {
      const data = await api.get<typeof items>("/api/notifications");
      setItems(data);
    } catch {}
  }

  async function remove(id: number) {
    try {
      await api.del(`/api/notifications/${id}`);
      await load();
    } catch {}
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('notifications.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map(n => (
                <div key={n.id} className="p-3 border rounded-md flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{n.title}</div>
                    {n.body ? <div className="text-sm text-muted-foreground">{n.body}</div> : null}
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={n.read ? "text-gray-500 border-gray-300" : "text-blue-600 border-blue-300"}>
                      {n.read ? t('notifications.read') : t('notifications.unread')}
                    </Badge>
                    <Button variant="ghost" size="icon" aria-label={t('notifications.delete')} onClick={() => remove(n.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  {t('notifications.noNotifications')}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}