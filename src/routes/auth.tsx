import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar na LUMA — gestão de tráfego pago" },
      {
        name: "description",
        content:
          "Acesse a LUMA v3 para gerenciar campanhas de Meta Ads e Google Ads com decisões aprovadas por você.",
      },
      { property: "og:title", content: "Entrar na LUMA" },
      {
        property: "og:description",
        content: "Plataforma brasileira de gestão semi-autônoma de tráfego pago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function traduzErro(mensagem: string) {
  if (/pwned|known to be weak|compromised/i.test(mensagem))
    return "Essa senha aparece em vazamentos públicos conhecidos. Escolha outra senha (evite nome + data de nascimento).";
  if (/invalid login credentials/i.test(mensagem)) return "E-mail ou senha inválidos.";
  if (/user already registered/i.test(mensagem))
    return "Este e-mail já possui cadastro. Use a aba Entrar.";
  if (/password should be at least/i.test(mensagem))
    return "A senha deve ter no mínimo 8 caracteres.";
  if (/email/i.test(mensagem) && /invalid/i.test(mensagem)) return "E-mail inválido.";
  if (/rate limit|too many/i.test(mensagem))
    return "Muitas tentativas seguidas. Aguarde um minuto e tente novamente.";
  return "Não foi possível concluir. Tente novamente.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  const entrar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      const texto = traduzErro(error.message);
      setErro(texto);
      toast.error(texto);
      return;
    }
    void navigate({ to: "/" });
  };

  const cadastrar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      const texto = "Use uma senha com pelo menos 8 caracteres.";
      setErro(texto);
      toast.error(texto);
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setCarregando(false);
    if (error) {
      const texto = traduzErro(error.message);
      setErro(texto);
      toast.error(texto);
      return;
    }
    toast.success("Conta criada. Bem-vindo à LUMA.");
    void navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-[0.25em] text-primary">LUMA</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestão semi-autônoma de tráfego pago
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <Tabs defaultValue="entrar" onValueChange={() => setErro(null)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="cadastrar">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="entrar">
              <form className="space-y-4 pt-4" onSubmit={(e) => void entrar(e)}>
                <Campos
                  email={email}
                  senha={senha}
                  onEmail={setEmail}
                  onSenha={setSenha}
                  autoComplete="current-password"
                />
                <MensagemErro texto={erro} />
                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="cadastrar">
              <form className="space-y-4 pt-4" onSubmit={(e) => void cadastrar(e)}>
                <Campos
                  email={email}
                  senha={senha}
                  onEmail={setEmail}
                  onSenha={setSenha}
                  autoComplete="new-password"
                  dica="Mínimo de 8 caracteres. A senha não pode ser uma que já apareceu em vazamentos públicos — evite nome + data de nascimento."
                />
                <MensagemErro texto={erro} />
                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Criar conta
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Ao criar a conta, seu workspace inicia em modo demonstração.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function MensagemErro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{texto}</span>
    </div>
  );
}

function Campos({
  email,
  senha,
  onEmail,
  onSenha,
  autoComplete,
  dica,
}: {
  email: string;
  senha: string;
  onEmail: (v: string) => void;
  onSenha: (v: string) => void;
  autoComplete: string;
  dica?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`email-${autoComplete}`}>E-mail</Label>
        <Input
          id={`email-${autoComplete}`}
          type="email"
          required
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`senha-${autoComplete}`}>Senha</Label>
        <div className="relative">
          <Input
            id={`senha-${autoComplete}`}
            type={visivel ? "text" : "password"}
            required
            minLength={8}
            autoComplete={autoComplete}
            placeholder="••••••••"
            className="pr-10"
            value={senha}
            onChange={(e) => onSenha(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {dica ? <p className="text-xs text-muted-foreground">{dica}</p> : null}
      </div>
    </>
  );
}
