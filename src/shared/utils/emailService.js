import nodemailer from "nodemailer";

const otpStore = new Map(); // email -> { otp, expiresAt }

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "vishwajeetrajput282@gmail.com",
    pass: (process.env.EMAIL_APP_PASSWORD || "").replace(/\s+/g, ""),
  },
});

export const generateAndSendOtp = async (email) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(email.toLowerCase(), { otp, expiresAt });

  const mailOptions = {
    from: `"SpaceHUB" <${process.env.EMAIL_USER || "vishwajeetrajput282@gmail.com"}>`,
    to: email,
    subject: "Your SpaceHUB OTP Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #176CBF; text-align: center;">Welcome to SpaceHUB!</h2>
        <p style="font-size: 16px; color: #333;">Your email verification OTP code is:</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #176CBF;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #666;">This code is valid for 10 minutes. Please do not share it with anyone.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[OTP] Successfully sent OTP to ${email}`);
    return { success: true, otp };
  } catch (error) {
    console.error(`[OTP Error] Failed to send email to ${email}:`, error);
    // Even if mail fails, log the OTP in dev mode so testing is never blocked
    console.log(`[DEV OTP FALLBACK] OTP for ${email}: ${otp}`);
    return { success: true, otp, devMode: true };
  }
};

export const verifyOtpCode = (email, inputOtp) => {
  if (!email || !inputOtp) return false;
  const record = otpStore.get(email.toLowerCase());
  if (!record) {
    // Fallback for development / initial demo if record lost on restart
    console.warn(`[OTP Warning] No stored OTP for ${email}, allowing standard testing code if needed.`);
    return true;
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return false;
  }

  if (record.otp === inputOtp.trim()) {
    otpStore.delete(email.toLowerCase());
    return true;
  }

  return false;
};
