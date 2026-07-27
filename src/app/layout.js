import "./globals.css";

export const metadata = {
  title: "요기보 수습평가 시스템",
  description: "요기보 매장 수습직원 역량평가 · 종합평가 관리"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
