import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const allowedRoles = new Set(["ADMIN", "CONSULTANT", "VIEWER"]);

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}.`);
  return value;
}

function assertDevelopmentOnly() {
  const environments = [
    process.env.APP_ENV,
    process.env.NEXT_PUBLIC_APP_ENV,
  ].map((value) => value?.trim().toLowerCase()).filter(Boolean);

  if (process.env.DEV_SEED_ENABLED !== "true") {
    throw new Error("Seed recusado: defina DEV_SEED_ENABLED=true explicitamente.");
  }
  if (environments.includes("production")) {
    throw new Error("Seed recusado: execução em produção é proibida.");
  }
}

async function findUserByEmail(
  admin: Pick<SupabaseClient, "auth">,
  email: string,
): Promise<User | null> {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) return null;
  }
  throw new Error("Limite seguro de paginação atingido ao procurar o usuário DEV.");
}

async function main() {
  assertDevelopmentOnly();

  const url = required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const email = required("DEV_ADMIN_EMAIL").toLowerCase();
  const password = required("DEV_ADMIN_PASSWORD");
  const displayName = required("DEV_ADMIN_NAME");
  const role = (process.env.DEV_ADMIN_ROLE?.trim() || "ADMIN").toUpperCase();

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("DEV_ADMIN_EMAIL inválido.");
  if (password.length < 12) throw new Error("DEV_ADMIN_PASSWORD deve possuir ao menos 12 caracteres.");
  if (displayName.length < 2 || displayName.length > 150) throw new Error("DEV_ADMIN_NAME inválido.");
  if (!allowedRoles.has(role)) throw new Error("DEV_ADMIN_ROLE deve ser ADMIN, CONSULTANT ou VIEWER.");

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let user = await findUserByEmail(admin, email);
  let createdUser = false;
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("Não foi possível criar o usuário DEV.");
    user = data.user;
    createdUser = true;
  }

  const { error: profileError } = await admin.from("admin_profiles").upsert({
    user_id: user.id,
    display_name: displayName,
    role,
    is_active: true,
    created_by: user.id,
  }, { onConflict: "user_id" });

  if (profileError) {
    if (createdUser) await admin.auth.admin.deleteUser(user.id);
    throw profileError;
  }

  console.log(`Conta DEV pronta para ${email} com perfil ${role}.`);
  console.log("A senha não foi exibida e o script não é executado automaticamente.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha ao provisionar a conta DEV.");
  process.exitCode = 1;
});
