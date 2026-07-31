import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// incrementalCache를 지정하지 않으면 프리렌더된 정적 페이지도 캐시에서 찾지 못해
// (x-nextjs-cache: MISS) 매 요청 Worker가 렌더링한다.
// 실측: 랜딩 첫 요청 CPU 400ms, 응답 1.5초까지 늘어났다.
//
// static-assets 어댑터는 빌드 시 생성된 프리렌더 결과를 Workers 정적 자산에서 읽는다.
// - KV/R2 같은 추가 리소스가 필요 없고 쓰기 비용도 발생하지 않는다
// - 런타임 재검증(ISR)은 지원하지 않는다. 현재 프리렌더 대상은
//   랜딩·로그인·약관처럼 빌드 시점에 확정되는 공통 페이지뿐이라 문제없다
//
// ⚠️ 멀티테넌트 주의: 캐시 키는 경로 기준이라 서브도메인을 구분하지 않는다.
//    테넌트마다 내용이 달라지는 페이지를 프리렌더 대상으로 만들면 안 된다.
//    (대시보드 등 인증 페이지는 307 리다이렉트로 캐시 대상이 아님을 실측 확인)
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
