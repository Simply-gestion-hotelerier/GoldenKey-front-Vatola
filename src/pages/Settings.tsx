// src/pages/settings/Settings.tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/rbac";
import { useTheme } from "next-themes";
import { useState, useRef } from "react";
import { Camera, Upload, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { i18n, t } = useTranslation();
  const isFr = i18n.language?.startsWith("fr");

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [isSaving, setIsSaving] = useState(false);

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      updateUser({ name, email, phone, avatar });
      toast.success(t('settings.profileUpdated'));
    } catch (error) {
      toast.error(t('settings.profileUpdateError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(t('settings.imageTooLarge'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatar(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeAvatar = () => {
    setAvatar("");
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
            <p className="text-muted-foreground">{t('settings.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('settings.profile')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatar} alt={name} />
                      <AvatarFallback className="text-lg">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex space-x-2">
                    {/* Avatar upload buttons commented out */}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('settings.fullName')}</label>
                    <Input
                      placeholder={t('settings.fullName')}
                      value={name}
                      disabled
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('common.email')}</label>
                    <Input
                      placeholder={t('common.email')}
                      type="email"
                      value={email}
                      disabled
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('common.phone')}</label>
                    <Input
                      placeholder={t('common.phone')}
                      value={phone}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('settings.appearance')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('settings.theme')}</label>
                  <Select value={(theme as string) || "light"} onValueChange={(v) => setTheme(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('settings.theme')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">🌞 {t('settings.light')}</SelectItem>
                      <SelectItem value="dark">🌙 {t('settings.dark')}</SelectItem>
                      <SelectItem value="system">💻 {t('settings.system')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('settings.themeDescription')}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">{t('settings.language')}</label>
                  <div className="flex items-center gap-1 border rounded-lg p-0.5">
                    <Button
                      variant={isFr ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs font-semibold"
                      onClick={() => i18n.changeLanguage("fr")}
                    >
                      🇫🇷 FR
                    </Button>
                    <Button
                      variant={!isFr ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs font-semibold"
                      onClick={() => i18n.changeLanguage("en")}
                    >
                      🇬🇧 EN
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}