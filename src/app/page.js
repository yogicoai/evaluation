import Link from "next/link";

export default function Home() {
  return (
    <main className="wrap narrow">
      <div style={{ maxWidth: 640, margin: "70px auto 0" }}>
        <div className="card">
          <div className="brand" style={{ marginBottom: 18 }}>
            <img className="brand-logo lg" src="https://yogibo.kr/web/img/icon/logo3_on.png" alt="Yogibo" />
          </div>
          <h1>수습직원 평가 시스템</h1>
          <p>용도에 맞는 페이지로 이동해 주세요. 평가자용 페이지는 비밀번호 입력이 필요합니다.</p>

          <h3 style={{ marginTop: 24, color: "#4e5968", fontSize: 14 }}>요기보 · 매장</h3>
          <div className="notice" style={{ marginTop: 10 }}>
            <Link href="/exam">
              <div><b>수습평가시험 (매장직원용)</b><br />본인의 매장명·이름·직급 선택 후 15분 시험 응시</div>
            </Link>
            <Link href="/grading">
              <div><b>수습평가시험 관리 (평가자용)</b><br />제출된 시험지 자동/수동 채점, 문항·정답 관리</div>
            </Link>
            <Link href="/overall">
              <div><b>수습 종합평가 (평가자용)</b><br />인사카드 + 매출(자동연동) + 역량 종합 평가 및 PDF 출력</div>
            </Link>
          </div>

          <h3 style={{ marginTop: 24, color: "#4e5968", fontSize: 14 }}>요기코퍼레이션 · 본사&물류</h3>
          <div className="notice" style={{ marginTop: 10 }}>
            <Link href="/hq">
              <div><b>수습기간 평가표 (평가자용)</b><br />본사&물류 수습직원 평가표 작성·게시판 관리 및 PDF 출력</div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
