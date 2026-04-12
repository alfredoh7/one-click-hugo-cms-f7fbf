import { admin, requestPasswordRecovery } from "@netlify/identity";

const inviteEmail = "yogaboy27@mac.com";
const tempPassword = "AVC-Temp-2026-Set-Your-Own!";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  try {
    const users = await admin.listUsers();
    let user = users.find(
      (entry) => entry.email && entry.email.toLowerCase() === inviteEmail,
    );
    let created = false;

    if (!user) {
      user = await admin.createUser({
        email: inviteEmail,
        password: tempPassword,
      });
      created = true;
    }

    await requestPasswordRecovery(inviteEmail);

    return Response.json({
      ok: true,
      created,
      email: inviteEmail,
      id: user.id,
      note: "Password setup email sent.",
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        email: inviteEmail,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};
