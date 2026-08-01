# ブランド書き出し素材

SNS など、アプリ外で使うアイコンの書き出し置き場。

## 円形アバター用（X / 旧Twitter など）

| ファイル | サイズ | 用途 |
|---|---|---|
| `yaranai-icon-x-400.png` | 400×400 | X のプロフィール画像（推奨サイズ） |
| `yaranai-icon-x-1024.png` | 1024×1024 | 高解像度が要る場合・他SNS の使い回し |

デザインの正は `docs/icon-k-circle-master.svg`（案K「苔むすY」の円形版）。
アプリアイコン `apps/yaranai-measured/assets/icon.png` から銘「YARANAI」を外し、
Y を中央に寄せて 1.32 倍に拡大したもの。円形トリミング半径に対して約 9% の余白が残る。

### 書き出し方法

SVG を 1024×1024 でラスタライズする。Chromium のヘッドレスシェルを使う場合:

```sh
headless_shell --headless --hide-scrollbars \
  --screenshot=yaranai-icon-x-1024.png --window-size=1024,1024 \
  file:///path/to/page.html   # docs/icon-k-circle-master.svg を width/height 1024px で埋め込んだHTML
```
