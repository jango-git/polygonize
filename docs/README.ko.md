# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · **ko** · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

브라우저에서 동작하는 로우폴리 이미지 편집기입니다. 사진을 불러오고, 삼각 분할을 다듬고, 형태 모디파이어로 가장자리를 정교하게 손질한 뒤 SVG나 PNG로 내보내세요.

**[편집기](https://jango-git.github.io/polygonize/)**

![스크린샷](../image.png)

## 주요 기능

- **스마트 포인트 시딩** - Sobel 에지 검출로 반지름이 달라지는 Bridson Poisson 디스크 샘플링입니다. 가장자리는 작은 최소 반지름(촘촘한 삼각형)을, 평탄한 영역은 큰 최대 반지름(성긴 삼각형)을 사용합니다. 생성 과정은 완전히 시드 기반이므로 같은 시드는 항상 같은 메시를 재현합니다
- **모디파이어 스택** - 비파괴 방식의 폴리라인, 원, Catmull-Rom 곡선 레이어가 기본 메시 위에 제약 에지를 추가합니다. 드래그 앤 드롭으로 자유롭게 순서를 바꾸거나 그룹으로 묶을 수 있습니다
- **색상 샘플링** - 삼각형마다 평균 또는 중앙값 픽셀 색상을 사용하며, 정점별 그라데이션도 선택할 수 있습니다
- **내보내기** - 벡터 SVG 또는 PDF, 혹은 래스터 PNG, JPG, WebP를 최대 4096px까지 지원합니다
- **프로젝트** - 작업을 `.json`으로 저장하고 복원할 수 있으며, 세션은 localStorage에 자동 저장됩니다
- **현지화된 UI** - 21개 인터페이스 언어를 지원하며, 브라우저에서 자동으로 감지되고 상단 바에서 전환할 수 있습니다

## 키보드 단축키

| 키      | 동작                          |
| ------- | ----------------------------- |
| `~`     | 커서 (선택)                   |
| `1`     | 폴리라인 도구                 |
| `2`     | Catmull-Rom 곡선 도구         |
| `3`     | 원 도구 (중심과 반지름)       |
| `4`     | 원 도구 (3점)                 |
| `Q`     | 배경 불투명도 전환            |
| `W`     | 포인트 불투명도 전환          |
| `E`     | 스파이크 오버레이 전환        |
| `F`     | 이미지를 화면에 맞추기        |
| `Space` | 열린 패스 적용                |
| `Esc`   | 그리기 취소 / 선택 해제       |

## 개발

```sh
npm install
npm run dev    # http://localhost:3000 에서 개발 서버 실행
npm run build  # dist/bundle.js 출력
```

## 라이선스

[MIT](../LICENSE)
