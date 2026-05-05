// pages/settings.tsx
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

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast.success("Profil mis à jour avec succès");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour du profil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("L'image ne doit pas dépasser 2MB");
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
            <h1 className="text-3xl font-bold">Paramètres</h1>
            <p className="text-muted-foreground">Compte • Thème</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Profil</CardTitle>
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
                    {/* <Button
                      size="icon"
                      variant="outline"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                      onClick={triggerFileInput}
                    >
                      <Camera className="h-4 w-4" />
                    </Button> */}
                  </div>
                  
                  {/* <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                   */}
                  <div className="flex space-x-2">
                    {/* <Button
                      variant="outline"
                      size="sm"
                      onClick={triggerFileInput}
                      className="flex items-center space-x-1"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Changer</span>
                    </Button>
                    {avatar && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={removeAvatar}
                      >
                        Supprimer
                      </Button>
                    )} */}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Nom complet</label>
                    <Input 
                      placeholder="Nom" 
                      value={name} 
                      disabled
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Email</label>
                    <Input 
                      placeholder="Email" 
                      type="email"
                      value={email} 
                      disabled
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Téléphone</label>
                    <Input 
                      placeholder="Téléphone" 
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
                <CardTitle>Apparence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Thème</label>
                  <Select value={(theme as string) || "light"} onValueChange={(v) => setTheme(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Thème"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">🌞 Clair</SelectItem>
                      <SelectItem value="dark">🌙 Sombre</SelectItem>
                      <SelectItem value="system">💻 Système</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Choisissez le thème qui s'applique à l'interface
                  </p>
                </div>

                {/* <div>
                  <label className="text-sm font-medium mb-2 block">Langue</label>
                  <Select defaultValue="fr">
                    <SelectTrigger>
                      <SelectValue placeholder="Langue"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div> */}
              </CardContent>
            </Card>

            {/* <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Préférences de notification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="email-notifs" defaultChecked className="rounded" />
                    <label htmlFor="email-notifs" className="text-sm">Notifications par email</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="push-notifs" defaultChecked className="rounded" />
                    <label htmlFor="push-notifs" className="text-sm">Notifications push</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="sms-notifs" className="rounded" />
                    <label htmlFor="sms-notifs" className="text-sm">Notifications SMS</label>
                  </div>
                </div>
              </CardContent>
            </Card> */}
          </div>
        </main>
      </div>
    </div>
  );
}