import "server-only";
import nodemailer from "nodemailer";

export async function sendMail(to: string, subject: string, text: string, html: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) throw new Error("SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be configured.");
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass },
  });
  await transporter.sendMail({ from: process.env.EMAIL_FROM || user, to, subject, text, html });
}
