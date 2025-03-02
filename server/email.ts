import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendSupportEmail(subject: string, message: string, fromUser: string) {
  const emailContent = `
Support Request from CIM Generator

From User: ${fromUser}
Subject: ${subject}

Message:
${message}
`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: "robertkale20@gmail.com",
    subject: `[CIM Generator Support] ${subject}`,
    text: emailContent,
  });
}
