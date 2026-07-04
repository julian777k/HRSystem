// PreToolUse(Bash) 훅 — 로컬 직접 배포 차단
// OpenNext는 Windows 로컬 빌드 시 명령이 성공(exit 0)해도 Worker 런타임이 500으로
// 죽는다. 배포는 반드시 git push → GitHub Actions(.github/workflows/deploy.yml)로.
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(input || '{}');
    const cmd = (j.tool_input && j.tool_input.command) || '';
    // 명령 "실행 위치"(시작 또는 && / ; / | 뒤)에 올 때만 차단.
    // 커밋 메시지·문서 등 따옴표 안의 단순 언급은 통과시킨다(false positive 방지).
    const danger = /(^|&&|\|\||\||;)\s*(npm run cf:(deploy|build)\b|(npx |pnpm |yarn )?wrangler\s+deploy\b|(npx )?opennextjs-cloudflare\s+build\b)/;
    if (danger.test(cmd)) {
      console.error(
        '🚫 로컬 직접 배포 금지 — OpenNext는 Windows 빌드 시 프로덕션이 500으로 죽습니다.\n' +
        '   배포는 반드시 git push → GitHub Actions(.github/workflows/deploy.yml)로 하세요.'
      );
      process.exit(2); // exit 2 = 도구 실행 차단(block)
    }
  } catch (_) {
    // 파싱 실패 시 통과 (훅이 정상 작업을 막지 않도록)
  }
  process.exit(0);
});
