// src/pages/auth/LoginPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth, Role, getUserData } from '../lib/rbac';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Hotel, Eye, EyeOff, ArrowRight, Moon, Stars, AlertCircle, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LoginFormData {
  username: string;
  password: string;
  role: Role | null;
}

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: '',
    role: null
  });

  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  // Effet pour l'arrière-plan interactif
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      life: number;
      maxLife: number;
      alpha: number;
      targetAlpha: number;
      vx: number;
      vy: number;
    }> = [];

    const colors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981',
      '#f59e0b', '#ef4444', '#06b6d4', '#84cc16', '#f97316'
    ];

    let mouseX = 0;
    let mouseY = 0;
    let isMouseMoving = false;
    let mouseStopTimeout: NodeJS.Timeout;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      isMouseMoving = true;

      clearTimeout(mouseStopTimeout);

      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.5;
        const distance = Math.random() * 30 + 10;

        particles.push({
          x: mouseX + Math.cos(angle) * distance,
          y: mouseY + Math.sin(angle) * distance,
          size: Math.random() * 20 + 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          speedX: Math.cos(angle) * 0.5 + (Math.random() - 0.5) * 2,
          speedY: Math.sin(angle) * 0.5 + (Math.random() - 0.5) * 2,
          life: 0,
          maxLife: Math.random() * 80 + 60,
          alpha: 0,
          targetAlpha: Math.random() * 0.8 + 0.4,
          vx: 0,
          vy: 0
        });
      }

      mouseStopTimeout = setTimeout(() => {
        isMouseMoving = false;
      }, 100);
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (p.alpha < p.targetAlpha) {
          p.alpha += 0.05;
        } else {
          p.alpha -= 0.02;
        }

        if (isMouseMoving) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            p.vx += dx * 0.0001;
            p.vy += dy * 0.0001;
          }
        }

        p.vx *= 0.95;
        p.vy *= 0.95;

        p.x += p.speedX + p.vx;
        p.y += p.speedY + p.vy;
        p.life++;

        p.speedY += 0.02;
        p.speedX += Math.sin(p.life * 0.05) * 0.1;

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        const alphaNormalized = Math.max(0, Math.min(1, p.alpha));
        const alphaHex = Math.round(alphaNormalized * 255).toString(16).padStart(2, '0');

        gradient.addColorStop(0, `${p.color}${alphaHex}`);
        gradient.addColorStop(0.5, `${p.color}${Math.round(alphaNormalized * 100).toString(16).padStart(2, '0')}`);
        gradient.addColorStop(1, `${p.color}00`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.shadowBlur = p.size;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (p.life >= p.maxLife || p.alpha <= 0.01) {
          particles.splice(i, 1);
          i--;
        }
      }

      if (particles.length > 200) {
        particles.splice(0, particles.length - 200);
      }

      requestAnimationFrame(animate);
    };

    animate();
    container.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      container.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(mouseStopTimeout);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name as keyof LoginFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }

    if (loginError) {
      setLoginError('');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginFormData> = {};

    if (!formData.username.trim()) {
      newErrors.username = t('login.usernameRequired');
    }
    if (!formData.password) {
      newErrors.password = t('login.passwordRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setLoginError('');

    try {
      const result = await login({
        username: formData.username,
        password: formData.password,
        role: formData.role!
      });

      if (result.success) {
        navigate('/');
      } else {
        setLoginError(result.error || t('login.error'));
      }

    } catch (error) {
      console.error('Login error:', error);
      setLoginError(t('login.connectionError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 relative overflow-hidden login-container"
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />
      <div className="absolute inset-0 z-1 stars-bg"></div>

      <div className="w-full max-w-sm relative z-10">
        <Card className="overflow-hidden bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/95 dark:from-blue-900/80 dark:via-blue-800/60 dark:to-blue-900/90 backdrop-blur-2xl shadow-2xl border border-slate-700/40 dark:border-blue-500/40 rounded-2xl transition-all duration-500 hover:shadow-slate-500/20 dark:hover:shadow-blue-500/20 hover:border-slate-500/50 dark:hover:border-blue-400/50">
          <div className="text-center py-8 px-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-blue-900 dark:via-blue-800 dark:to-blue-900 relative overflow-hidden border-b border-slate-700/40 dark:border-blue-500/30">
            <div className="absolute inset-0 opacity-50">
              <div className="absolute -top-10 -left-10 w-24 h-24 bg-slate-600/30 dark:bg-blue-500/30 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-slate-500/20 dark:bg-blue-400/20 rounded-full blur-xl animate-pulse delay-500"></div>
            </div>

            <div className="mb-4 flex justify-center relative">
              <div className="relative group">
                <img
                  src="/logo_s.png"
                  alt="Simply Hotel Logo"
                  className="w-24 h-24 object-contain drop-shadow-2xl filter brightness-110 contrast-125 saturate-150 dark:brightness-110 dark:contrast-125 dark:saturate-150 transition-all duration-700 group-hover:brightness-125 group-hover:contrast-150 group-hover:saturate-200 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-transparent to-slate-400/20 dark:from-amber-400/30 dark:to-blue-400/30 rounded-full blur-xl animate-pulse mix-blend-overlay"></div>
                <div className="absolute -inset-4 bg-slate-400/10 dark:bg-blue-400/20 rounded-full blur-lg animate-pulse"></div>
              </div>
            </div>

            <div className="relative">
              <h1 className="text-2xl font-bold bg-gradient-to-br from-slate-200 via-white to-slate-200 dark:from-blue-200 dark:via-white dark:to-blue-200 bg-clip-text text-transparent mb-2 tracking-tight">
                Simply
              </h1>
              <div className="w-16 h-0.5 bg-gradient-to-r from-slate-400 to-slate-300 dark:from-blue-400 dark:to-blue-300 mx-auto mb-2 rounded-full shadow-sm"></div>
              <p className="text-slate-300/90 dark:text-blue-200/90 text-xs font-light tracking-wide">
                {t('login.hotelManagement')}
              </p>
            </div>
          </div>

          <CardContent className="p-6 bg-slate-800/40 dark:bg-blue-900/50 backdrop-blur-xl">
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-slate-100 dark:text-blue-100 mb-2 tracking-tight">
                {t('login.title')}
              </h2>
              <div className="w-12 h-0.5 bg-gradient-to-r from-slate-400 to-slate-300 dark:from-blue-400 dark:to-blue-300 mx-auto mb-2 rounded-full"></div>
              <p className="text-slate-300/80 dark:text-blue-200/80 text-xs">
                {t('login.secureAccess')}
              </p>
            </div>

            {loginError && (
              <div className="mb-6 rounded-xl border border-red-400/40 dark:border-blue-400/40 bg-red-900/30 dark:bg-blue-800/40 backdrop-blur-lg px-4 py-3 text-xs text-red-100 dark:text-blue-100 shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 bg-red-500/40 dark:bg-blue-500/40 rounded-full flex items-center justify-center border border-red-400/40 dark:border-blue-400/40">
                      <svg className="h-3 w-3 text-red-200 dark:text-blue-200" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 font-medium text-sm">{loginError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="username" className="text-slate-300/90 dark:text-blue-200/90 text-xs font-medium tracking-wide">
                  {t('login.username')}
                </Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-slate-500/10 dark:bg-blue-500/10 rounded-lg blur-sm opacity-0 group-focus-within:opacity-100 transition-all duration-300"></div>
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400/80 dark:text-blue-300/80 group-focus-within:text-amber-400 transition-all duration-300 z-10" />
                  <Input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder={t('login.usernamePlaceholder')}
                    className="pl-10 pr-4 h-11 text-sm border-slate-600/40 dark:border-blue-500/40 bg-slate-700/50 dark:bg-blue-800/60 backdrop-blur-lg text-white placeholder:text-slate-400/60 dark:placeholder:text-blue-200/60 focus:border-amber-400 focus:ring-1 focus:ring-amber-500/40 rounded-lg transition-all duration-300 input-field relative z-10 hover:bg-slate-700/60 dark:hover:bg-blue-800/70"
                  />
                </div>
                {errors.username && (
                  <p className="text-xs text-amber-300/90 mt-1 flex items-center space-x-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.username}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="password" className="text-slate-300/90 dark:text-blue-200/90 text-xs font-medium tracking-wide">
                  {t('login.password')}
                </Label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-slate-500/10 dark:bg-blue-500/10 rounded-lg blur-sm opacity-0 group-focus-within:opacity-100 transition-all duration-300"></div>
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400/80 dark:text-blue-300/80 group-focus-within:text-amber-400 transition-all duration-300 z-10" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={t('login.passwordPlaceholder')}
                    className="pl-10 pr-10 h-11 text-sm border-slate-600/40 dark:border-blue-500/40 bg-slate-700/50 dark:bg-blue-800/60 backdrop-blur-lg text-white placeholder:text-slate-400/60 dark:placeholder:text-blue-200/60 focus:border-amber-400 focus:ring-1 focus:ring-amber-500/40 rounded-lg transition-all duration-300 input-field relative z-10 hover:bg-slate-700/60 dark:hover:bg-blue-800/70"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400/80 dark:text-blue-300/80 hover:text-amber-400 focus:outline-none transition-all duration-300 z-10 group/eye p-1 rounded hover:bg-amber-400/10"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 group-hover/eye:scale-110 transition-transform" />
                    ) : (
                      <Eye className="h-4 w-4 group-hover/eye:scale-110 transition-transform" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-amber-300/90 mt-1 flex items-center space-x-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 backdrop-blur-lg text-white font-semibold rounded-lg shadow-lg transition-all duration-500 transform hover:scale-[1.02] hover:shadow-amber-500/25 active:scale-[0.98] group relative overflow-hidden border border-amber-400/50"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2 relative z-10">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-amber-200 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-amber-200 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-amber-200 rounded-full animate-bounce"></div>
                    </div>
                    <span className="text-white font-medium">{t('login.loggingIn')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2 relative z-10">
                    <span className="text-white font-medium">{t('login.loginButton')}</span>
                    <ArrowRight className="h-4 w-4 text-white transition-all duration-300 group-hover:translate-x-1" />
                  </div>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button className="text-slate-400/80 dark:text-blue-300/80 hover:text-amber-400 text-xs transition-all duration-300 hover:underline underline-offset-2">
                {t('login.forgotPassword')}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center space-x-4 text-slate-500/70 dark:text-blue-400/70 text-xs">
            <span>© {new Date().getFullYear()} Simply</span>
            <div className="w-1 h-1 bg-slate-500/60 dark:bg-blue-400/60 rounded-full"></div>
            <span>v2.4.1</span>
          </div>
        </div>
      </div>

      <style>{`
        .login-container {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
        }
        .stars-bg {
          background-image: radial-gradient(2px 2px at 20px 30px, rgba(238, 238, 238, 0.6), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 40px 70px, rgba(255, 255, 255, 0.8), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 90px 40px, rgba(221, 221, 221, 0.5), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 130px 80px, rgba(255, 255, 255, 0.7), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 160px 30px, rgba(221, 221, 221, 0.6), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 200px 60px, rgba(238, 238, 238, 0.5), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 230px 20px, rgba(255, 255, 255, 0.8), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 270px 70px, rgba(221, 221, 221, 0.4), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 300px 40px, rgba(238, 238, 238, 0.6), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 330px 80px, rgba(255, 255, 255, 0.7), rgba(0,0,0,0)),
            radial-gradient(1px 1px at 360px 50px, rgba(221, 221, 221, 0.5), rgba(0,0,0,0)),
            radial-gradient(2px 2px at 390px 20px, rgba(238, 238, 238, 0.6), rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 400px 400px;
          animation: twinkle 25s linear infinite;
        }
        @keyframes twinkle {
          0% { background-position: 0 0; opacity: 0.8; }
          50% { opacity: 1; }
          100% { background-position: 400px 400px; opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;