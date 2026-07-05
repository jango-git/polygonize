# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · **ko** · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

사진을 삼각형으로 이루어진 로우폴리(low-poly) 이미지로 바꿔주는 브라우저 에디터입니다. 일반적인 생성기와의 가장 큰 차이는, 자동으로 만들어진 기본 격자 위에 사용자가 직접 안내선을 그릴 수 있고, 삼각형의 변이 그 안내선을 따라가도록 만들 수 있다는 점입니다. 턱선, 안경테, 실루엣 같은 중요한 윤곽선이 무작위 격자 속에 묻히지 않고 선명하게 남습니다.

**[에디터 열기](https://jango-git.github.io/tesselot/)**

![스크린샷](../image.png)

## 주요 기능

- **안내선.** 이미지 위에 선, 원, 부드러운 곡선을 그리면 삼각형들이 그 선을 따라 정렬됩니다. 이는 일회성 작업이 아니라 모디파이어(modifier)로 취급되므로 언제든지 이동하거나 디테일을 조정하거나 그룹으로 묶을 수 있습니다.
- **디테일에 맞춰 조정되는 격자.** 세부 요소와 뚜렷한 경계가 많은 곳은 삼각형이 작아지고, 하늘처럼 균일한 영역에서는 삼각형이 커집니다. 필요한 곳은 정교하게, 나머지는 차분하게 표현됩니다.
- **자동 윤곽선 추출.** 빈 화면에서 시작하지 않도록 "윤곽 추출"을 누르면 에디터가 이미지의 경계를 찾아 편집 가능한 모디파이어로 변환하고, 별도의 그룹으로 묶어줍니다.
- **삼각형 색상.** 각 삼각형은 그 아래 픽셀들의 평균 색으로 채워집니다. 밝은 이상치를 완화하고 싶다면 중앙값(median) 색상을 사용할 수도 있습니다.
- **내보내기.** 벡터(SVG, PDF) 또는 래스터(PNG, JPG, WebP)로, 최대 4096픽셀까지 내보낼 수 있습니다.
- **프로젝트.** 작업 내용을 `.json` 파일로 저장하고 나중에 다시 불러올 수 있습니다. 탭을 그냥 닫아도 현재 세션은 자동으로 복원됩니다.
- **21개 언어 지원 인터페이스.** 언어는 브라우저 설정에 따라 자동으로 선택되며, 상단 패널에서 전환할 수 있습니다.

## 내부 동작

점의 배치는 가변 반경을 사용하는 포아송 디스크 샘플링(Bridson 알고리즘)으로 이루어지며, 반경은 Sobel 경계 맵에 의해 결정되므로 윤곽선을 따라 격자가 더 조밀해집니다. 생성 과정은 결정론적이어서 동일한 시드는 항상 동일한 격자를 만들어냅니다. 무거운 기하 연산 파이프라인 전체 - 경계 맵, 점 배치, 삼각분할 - 는 Rust로 작성된 WASM 모듈에 들어 있으며, 삼각형 색상은 별도로 Web Worker에서 계산됩니다.

소스 코드를 읽어볼 계획이라면 [아키텍처 개요](onboarding.ko.md)부터 시작하세요.

## 개발

```sh
npm install
npm run dev    # http://localhost:3000 에서 개발 서버 실행
npm run build  # dist/bundle.js 생성
```

## 라이선스

[MIT](../LICENSE)
