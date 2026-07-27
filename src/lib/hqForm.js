// 요기코퍼레이션 수습기간 평가표 (본사&물류)
// 원본: "요기코퍼레이션 수습기간 평가표 서식_2024년 본사&물류.doc" 그대로 이관
export const HQ_COMPANY = "요기코퍼레이션";
export const HQ_SCALE_LABELS = ["탁월", "우수", "보통", "미흡", "부족"];

// 배점 스케일: 10점 문항(10/8/6/4/2), 5점 문항(5/4/3/2/1)
const S10 = [10, 8, 6, 4, 2];
const S5 = [5, 4, 3, 2, 1];

export const HQ_CATEGORIES = [
  {
    name: "업무능력",
    items: [
      { text: "자신의 업무를 숙지하고 전문성을 키우기 위해 노력한다", scale: S10 },
      { text: "수습기간 중 계획성 있게 업무를 수행한다", scale: S10 },
      { text: "정확하고 신속하게 업무를 수행하고 마무리를 잘 한다", scale: S10 },
      { text: "상사의 지시 명령과 요점 등을 정확하게 파악한다", scale: S10 },
      { text: "자신의 의견, 생각, 주장 등을 명확하게 전달한다", scale: S5 }
    ]
  },
  {
    name: "근무태도",
    items: [
      { text: "무단결근이나 지각, 조퇴가 없다.", scale: S10 },
      { text: "상사와 동료 간에 예의 있게 행동한다.", scale: S5 },
      { text: "주어진 업무를 성실하게 완수한다.", scale: S5 },
      { text: "교육태도는 성실하며 배우려는 열정과 열의를 보인다", scale: S5 },
      { text: "사내 규정을 잘 준수하며 상사 지시에 긍정적이다", scale: S5 }
    ]
  },
  {
    name: "발전 가능성",
    items: [
      { text: "새로운 업무 및 변화되는 현실에 대하여 잘 적응한다", scale: S5 },
      { text: "업무에 효율을 높이려는 의지가 있다", scale: S5 },
      { text: "업무 수행에 필요한 건강과 정신을 보유하고 있다", scale: S5 },
      { text: "업무 수행에 있어 창의적인 방법과 아이디어를 창출하여 업무를 개선하려는 의지가 있다", scale: S5 },
      { text: "회사에 대한 자부심과 주인의식을 가지고 있다", scale: S5 }
    ]
  }
];

// 평면 목록 (인덱스가 점수 저장 키: scores[i])
export const HQ_ITEMS = HQ_CATEGORIES.flatMap((cat) =>
  cat.items.map((item) => ({ ...item, category: cat.name, max: item.scale[0] }))
);
export const HQ_TOTAL_MAX = HQ_ITEMS.reduce((s, x) => s + x.max, 0); // 100

export function hqTotal(scores) {
  return HQ_ITEMS.reduce((sum, item, i) => {
    const v = Number(scores?.[i]);
    return sum + (item.scale.includes(v) ? v : 0);
  }, 0);
}

export function hqAnsweredCount(scores) {
  return HQ_ITEMS.filter((item, i) => item.scale.includes(Number(scores?.[i]))).length;
}

// 평가기준: A (80점 이상) 고용 확정 / B (75~79점) 수습 연장 / C (74점 이하) 고용 취소
export function hqGrade(total) {
  if (total >= 80) return { grade: "A", label: "A (80점 이상)", result: "고용 확정", tone: "ok" };
  if (total >= 75) return { grade: "B", label: "B (75~79점)", result: "수습 연장", tone: "warn" };
  return { grade: "C", label: "C (74점 이하)", result: "고용 취소", tone: "danger" };
}

export const HQ_GRADE_CRITERIA = "A (80점 이상): 고용 확정 / B (75~79점): 수습 연장 / C (74점 이하): 고용 취소";
