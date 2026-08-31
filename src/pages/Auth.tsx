import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { z } from "zod";
import logoSD from "@/assets/logo-sd.jpeg";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "Senha deve ter pelo menos 6 caracteres");

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
      setCheckingAuth(false);
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
      setCheckingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = (): boolean => {
    try {
      emailSchema.parse(email);
    } catch {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive",
      });
      return false;
    }

    try {
      passwordSchema.parse(password);
    } catch {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return false;
    }

    if (!isLogin && password !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha deve ser igual à senha.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Email ou senha incorretos.");
          }
          throw error;
        }
        toast({
          title: "Bem-vindo!",
          description: "Login realizado com sucesso.",
        });
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (error) {
          if (error.message.includes("User already registered")) {
            throw new Error("Este email já está cadastrado. Faça login.");
          }
          throw error;
        }
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao processar solicitação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen gradient-purple flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-purple flex items-center justify-center p-4 promob-grid">
      <div className="w-full max-w-md">
        {/* Glass Card */}
        <div className="glass rounded-[50px] p-8 md:p-12 shadow-2xl animate-slide-up">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-primary shadow-gold mb-4">
              <img src={logoSD} alt="SD Móveis" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold text-gradient-gold">SD Móveis</h1>
            <p className="text-sm text-muted-foreground mt-1">Sistema PRO AI v5.3</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 rounded-xl bg-muted/50 border-border focus:border-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirmar Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:border-primary"
                    required
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold bg-accent hover:bg-accent/90 text-white shadow-lg hover:shadow-xl transition-all"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processando...
                </>
              ) : isLogin ? (
                "Entrar"
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setConfirmPassword("");
                }}
                className="ml-1 font-semibold text-accent hover:underline"
              >
                {isLogin ? "Cadastre-se" : "Faça login"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-white/60">
          © 2024 SD Móveis Projetados. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
