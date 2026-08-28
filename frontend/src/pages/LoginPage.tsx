import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Mode = "login" | "register";

export function LoginPage() {
  const { status, login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-stone-100 text-stone-500">
        Comprobando sesión…
      </div>
    );
  }

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "register") {
        await register(username, password, inviteCode);
      } else {
        await login(username, password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError("Usuario o contraseña incorrectos");
        } else if (err.status === 403) {
          setError("Código de invitación no válido");
        } else if (err.status === 409) {
          setError("Ese nombre de usuario ya existe");
        } else {
          setError(err.message || "No se pudo completar la acción");
        }
      } else {
        setError(
          mode === "register"
            ? "No se pudo crear la cuenta"
            : "No se pudo iniciar sesión",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200";

  return (
    <div className="flex min-h-svh items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-serif text-4xl tracking-tight text-stone-900">
            Calone
          </h1>
          <p className="text-sm text-stone-500">
            {mode === "login"
              ? "Inicia sesión para continuar"
              : "Crea una cuenta con tu código de invitación"}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
        >
          <label className="block space-y-2 text-left">
            <span className="text-sm font-medium text-stone-700">Usuario</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block space-y-2 text-left">
            <span className="text-sm font-medium text-stone-700">
              Contraseña
            </span>
            <input
              type="password"
              name="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "register" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>

          {mode === "register" ? (
            <label className="block space-y-2 text-left">
              <span className="text-sm font-medium text-stone-700">
                Código de invitación
              </span>
              <input
                type="text"
                name="inviteCode"
                autoComplete="off"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className={inputClass}
              />
            </label>
          ) : null}

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:opacity-60"
          >
            {submitting
              ? mode === "register"
                ? "Creando cuenta…"
                : "Entrando…"
              : mode === "register"
                ? "Crear cuenta"
                : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500">
          {mode === "login" ? (
            <>
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                className="font-medium text-stone-800 underline-offset-2 hover:underline"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
              >
                Registrarse
              </button>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta?{" "}
              <button
                type="button"
                className="font-medium text-stone-800 underline-offset-2 hover:underline"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                Iniciar sesión
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
