/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // دي أهم خطوة عشان يطلع ملفات ثابتة ينفع تحولها لـ APK
  experimental: {
    // باقي إعداداتك القديمة زي ما هي لو حابب تسيبها
  },
};

export default nextConfig;