# Điều hành các model opencode — sổ tay cho phiên Claude Code

*Viết 2026-11-17 bởi Claude Fable 5.2, sau khi đo thật trên máy này. Người đọc: phiên
Claude Code kế tiếp (Opus). Đọc hết một lần trước khi giao việc đầu tiên.*

Bạn là **người điều hành** (trưởng phòng). Các model chạy qua `opencode` là **worker**.
Bạn chia việc, viết brief, chạy worker ở chế độ nền, kiểm tra kết quả bằng chính tay
mình, rồi mới báo người dùng. Worker rẻ và nhanh nhưng không biết gì ngoài brief, và
báo cáo của nó là lời khai, không phải bằng chứng.

## 1. Điều kiện trên máy này

| Thứ | Giá trị |
|---|---|
| opencode | 1.19.5, `C:\Users\admin\AppData\Roaming\npm\opencode` |
| Cấu hình | `~/.config/opencode/opencode.json`, provider `byteplus` trỏ tới gói **BytePlus Coding Plan** |
| Khóa API | Biến môi trường `ARK_API_KEY` ở mức **User** của Windows |
| Dữ liệu phiên | `~/.local/share/opencode/opencode.db` (SQLite; AgentwatchUI đọc file này) |

**Bẫy số 1: thiếu khóa.** Shell do ứng dụng Claude mở thường không có `ARK_API_KEY`,
và mọi model `byteplus/*` trả lỗi `the API key or AK/SK in the request is missing or
invalid`. `run-worker.sh` tự nạp khóa từ môi trường User. Nếu gọi `opencode` trực tiếp,
nạp trước:

```bash
export ARK_API_KEY="$(powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('ARK_API_KEY','User')" | tr -d '\r\n')"
```

Không in khóa ra màn hình, không ghi khóa vào file nào.

## 2. Model nào làm việc gì

Đo ngày 2026-11-17 bằng hai bài trong `orchestra/bench/`: bài code (viết bộ tính biểu
thức, 34 ca kiểm ẩn) và bài nhìn ảnh (6 câu hỏi về một ảnh pixel art).

| Chức vụ (`roles.conf`) | Model | Code | Thời gian | Nhìn ảnh | Dùng cho |
|---|---|---|---|---|---|
| `coder` | `byteplus/deepseek-v4-pro-ga-260813` | 34/34 | 173 s | không | Logic khó, backend, thuật toán, dữ liệu. Chậm nhưng chắc. |
| `builder` | `byteplus/ark-code-latest` | 34/34 | 54 s | không | Việc code thông thường, ghép nối, dựng cảnh. Nhanh nhất trong nhóm đạt điểm tối đa. |
| `art` | `byteplus/seed-2-0-code-preview-260328` | 34/34 | 241 s | 6/6 | Đồ họa, sprite, mọi việc phải **nhìn** kết quả rồi sửa. |
| `ui` | `byteplus/deepseek-v4-1-flash-261017` | 34/34 | 62 s | 6/6 | HTML/CSS, giao diện, đọc ảnh chụp màn hình. |
| `qa` | `byteplus/seed-2-0-pro-260328` | 33/34 | 31 s | 6/6 | Viết và chạy test, soát việc của model khác, xem ảnh chụp. |
| `chore` | `byteplus/seed-2-0-lite-260428` | 31/34 | 42 s | 6/6 | Tài liệu, đổi tên, việc lặp. **Không giao logic.** |
| `reserve` | `opencode/big-pickle` | 34/34 | 164 s | không | Dự bị miễn phí khi gói BytePlus hỏng. |
| `reserve-eyes` | `opencode/nemotron-3.5-super-vl-free` | chưa đo | — | 6/6 | Dự bị miễn phí có mắt. |

Nguyên tắc xếp:

- Việc phải nhìn ảnh (đồ họa, giao diện, so ảnh chụp) chỉ giao cho model có cột "Nhìn
  ảnh" đạt. `ark-code-latest` và `deepseek-v4-pro` trả lời `CANNOT SEE` khi được đưa ảnh.
- Người kiểm (`qa`) phải là model **khác họ** với người viết. Đừng để một model tự chấm
  bài của nó.
- Model miễn phí của `opencode/*` có thể dùng dữ liệu gửi lên để huấn luyện. Chỉ dùng
  cho việc không nhạy cảm.

**Không dùng được** (đã thử):

- `byteplus/glm-5-2-260617`, `byteplus/glm-5-3-flash-260828`: trả lời câu ngắn được,
  nhưng treo quá 7 phút không ghi file nào khi phải gọi công cụ.
- `byteplus/dola-seed-2-1-turbo-260628`, `byteplus/seed-2-0-mini-260428`: gói Coding Plan
  từ chối (`does not support the coding plan feature`).
- Các bản `deepseek-v4-flash-*`, `deepseek-v4-pro-260425`, `...-economy-...`: chạy được,
  chưa đo, không cần vì đã có bản mới hơn cùng họ.

Danh sách model đổi theo thời gian. Khi `opencode models` hiện tên mới hoặc một model
trong bảng bắt đầu lỗi, đo lại theo mục 9 rồi sửa `roles.conf` và bảng này.

## 3. Lệnh chạy

Luôn chạy qua `orchestra/run-worker.sh`, từ thư mục gốc của dự án, **ở chế độ nền**
(`run_in_background: true` của công cụ Bash). Mỗi worker một lệnh Bash riêng để bạn
nhận thông báo riêng khi từng worker xong.

```bash
bash orchestra/run-worker.sh <chức vụ | provider/model> <brief.md> [thư mục dự án]
```

Ví dụ:

```bash
bash orchestra/run-worker.sh coder briefs/B1-backend.md
bash orchestra/run-worker.sh art briefs/B2-sprites.md
bash orchestra/run-worker.sh byteplus/seed-2-0-pro-260328 briefs/Q1-check.md
```

Script làm những việc sau:

1. Tra chức vụ trong `orchestra/roles.conf` ra tên model.
2. Nạp `ARK_API_KEY` nếu thiếu; dừng nếu thiếu `AGENTS.md` hoặc brief.
3. Chạy `opencode run --auto -m <model> --dir <dự án> --title "[chức vụ] tên-brief"` với
   lời nhắc cố định: đọc `AGENTS.md`, làm đúng brief, kết thúc bằng khối báo cáo.
4. Ghi toàn bộ đầu ra vào `.orchestra/logs/<giờ>-<brief>-<chức vụ>.log`, thêm một dòng
   vào `.orchestra/runs.tsv`, in 40 dòng cuối (thường là khối báo cáo).
5. Trả mã thoát của opencode; `124` nghĩa là hết giờ.

Biến môi trường: `WORKER_TIMEOUT` (giây, mặc định 1500), `WORKER_VARIANT` (mức suy luận
của model, ví dụ `high`), `WORKER_PROMPT` (thay lời nhắc cố định, dùng khi trả việc về).

Lệnh gốc, khi cần gọi tay:

```bash
opencode run --auto -m byteplus/ark-code-latest --dir "D:/DungHA/AgentwatchUI" --title "[builder] B4-scene" -- "Read AGENTS.md first. Then do the task in briefs/B4-scene.md exactly as written."
```

Các cờ đáng nhớ của `opencode run`:

| Cờ | Tác dụng |
|---|---|
| `-m provider/model` | Chọn model. Bắt buộc ghi rõ; mặc định trong cấu hình là `ark-code-latest`. |
| `--auto` | Tự đồng ý mọi quyền chưa bị cấm. Không có cờ này worker sẽ kẹt ở câu hỏi quyền. Vì vậy brief và `AGENTS.md` phải cấm rõ những gì không được làm. |
| `--dir` | Thư mục làm việc của worker. Luôn là gốc dự án. |
| `-f đường/dẫn/ảnh.png` | Đính ảnh vào lời nhắc (chỉ có ích với model có mắt). |
| `-s <ses_...>` / `-c` | Tiếp tục một phiên cũ. Dùng để **trả việc về đúng worker đó**, nó còn nhớ ngữ cảnh. |
| `--title` | Tên phiên; AgentwatchUI hiện tên này làm "việc đang làm". |
| `--format json` | In sự kiện thô dạng JSON thay vì văn bản. |
| `--variant` | Mức suy luận theo từng nhà cung cấp. |

Lệnh khác: `opencode models [provider] [--verbose]`, `opencode session list`,
`opencode stats`, `opencode export <ses_...>`.

Giới hạn:

- Tối đa **3 worker song song**, và chỉ khi danh sách file của chúng không trùng nhau.
- Một worker treo không tự chết. Nếu sau thời gian dự kiến gấp đôi mà log không dài
  thêm, coi là treo: dừng nó, đổi model, đừng chờ.
- Trên Git Bash, `timeout` giết được tiến trình vỏ; kiểm tra lại
  `Get-CimInstance Win32_Process -Filter "Name='opencode.exe'"` nếu nghi còn sót.

## 4. Viết hướng dẫn cho worker

Worker đọc ba thứ, theo thứ tự: `AGENTS.md` (luật chung, opencode tự nạp file này),
brief của nó, và các file brief chỉ tới. Viết cả ba bằng **tiếng Anh**; chữ hiện cho
người dùng mới là tiếng Việt.

### 4.1 `AGENTS.md` (một file cho cả dự án)

Chứa luật không đổi giữa các việc: chỉ sửa file được giao; cấm `git commit/push/reset/
checkout/clean/stash`; cấm cài gói; cấm để server chạy lại; không hỏi và ngồi chờ; mẫu
báo cáo `STATUS / SUMMARY / FILES CHANGED / VERIFIED / REQUESTS / QUESTIONS / RISKS`;
`DONE` chỉ khi đã chạy và thấy phép kiểm qua. Bản mẫu: `AGENTS.md` của repo này.

### 4.2 Hợp đồng chung (`docs/SPEC.md`)

Khi hai worker trở lên phải khớp nhau (backend với giao diện, hình với cảnh), **bạn**
viết hợp đồng trước: tên file, chữ ký hàm, hình dạng JSON, kích thước, đơn vị. Worker
không được sửa hợp đồng. Đây là phần việc đáng công nhất của người điều hành: hợp đồng
càng chính xác thì các phần làm song song càng ít lệch.

### 4.3 Brief (mỗi việc một file trong `briefs/`)

Sáu mục, không thiếu mục nào:

```markdown
# <mã> — <tên việc>
## Objective        một hai câu: khi xong thì điều gì phải đúng
## Read first       file và mục cần đọc (ghi số mục, đừng bắt đọc cả tài liệu dài)
## Files you may change   đường dẫn chính xác; mọi thứ khác chỉ được đọc
## Constraints      thư viện được dùng, API được dùng, thứ không được đổi, bẫy đã biết
## Done when        các lệnh worker tự chạy được và đầu ra mong đợi
## Return           khối báo cáo của AGENTS.md, cộng thứ riêng của việc này
```

Kinh nghiệm viết:

- **Chia theo quyền sở hữu file**, không chia theo bước. Hai worker không bao giờ cùng
  sửa một file trong một vòng. File dùng chung do bạn sửa sau, từ mục `REQUESTS`.
- **"Done when" phải là lệnh chạy được**, in ra thứ so được: `node --test`, một lệnh
  `curl`, một script kết xuất. "Trông ổn" không phải phép kiểm.
- **Nói thẳng điều worker không làm được.** Ví dụ: "bạn không xem được trình duyệt, hãy
  ghi rõ là chưa xem". Nếu không, nó sẽ khai là đã xem.
- **Model có mắt chỉ thấy ảnh bạn đính bằng `-f`.** Nó không tự mở được file PNG
  trong lúc làm (đã thử: worker `art` khai thật là "cannot visually inspect", và vẽ
  nhân vật hỏng). Vòng nhìn và sửa do **bạn** quay: worker viết mã vẽ, bạn kết xuất ra
  PNG (`node orchestra/render-sprites.js`), tự xem, rồi tiếp tục phiên của worker với
  ảnh đính kèm và lời chê cụ thể:
  ```bash
  WORKER_PROMPT="The PNGs are attached. Problems: (1) ... (2) ... Fix only public/js/sprites.js." \
    bash orchestra/run-worker.sh art briefs/B2-sprites.md . -s ses_xxx -f .orchestra/preview/chars.png
  ```
- **Ghi bẫy bạn đã biết** vào Constraints (ví dụ: transcript của Claude Code lặp một
  `message.id` nhiều dòng, phải khử trùng). Worker sẽ không tự phát hiện.
- **Giới hạn API khi công cụ kiểm chỉ hỗ trợ một phần** (ví dụ canvas giả chỉ có
  `fillRect`). Nói rõ, kèm cách làm thay thế.
- Đưa ví dụ dữ liệu thật, một hai dòng, thay vì mô tả bằng lời.
- Việc cần kết quả của việc khác thì chạy sau, và brief trỏ tới file **đã có thật**.
- Brief dài 40 đến 70 dòng là vừa. Dài hơn thì tách việc.

## 5. Quy trình một vòng giao việc

1. **Chia việc** theo file. Ghi ra việc nào chờ việc nào.
2. **Viết** hợp đồng (nếu cần) và các brief.
3. **Đặt mốc** để thấy rõ worker đổi gì: `git add -A` (không commit). Sau đó
   `git status --short` và `git diff` chỉ hiện phần worker vừa làm.
4. **Chạy** các worker độc lập cùng lúc, ở chế độ nền. Trong lúc chờ, làm việc của
   bạn (viết brief vòng sau, tài liệu), đừng ngồi dò log.
5. **Soát** từng worker khi nó xong, theo đúng thứ tự này:
   - Đọc `STATUS`. `PARTIAL` hay `BLOCKED` thì xử lý trước.
   - `git status --short`: có file nào ngoài danh sách được phép không. Có thì đọc
     từng dòng hoặc khôi phục.
   - **Tự chạy lại** phép kiểm "Done when". Đừng tin dòng `VERIFIED`.
   - Đọc diff của phần quan trọng. Với thứ nhìn thấy được: mở lên và chụp ảnh.
6. **Trả việc về** khi kiểm không qua: tiếp tục đúng phiên đó, nói chính xác cái gì
   sai và dán đầu ra lỗi.
   ```bash
   opencode session list            # lấy ses_... có tên "[chức vụ] tên-brief"
   WORKER_PROMPT="The check failed: <dán đầu ra>. Fix only <file>. Re-run <lệnh>." \
     bash orchestra/run-worker.sh coder briefs/B1-backend.md . -s ses_xxx
   ```
   Sau **hai lần** trả về mà vẫn hỏng: tự làm, hoặc đổi sang model mạnh hơn.
7. **Tích hợp**: áp các `REQUESTS` vào file dùng chung, chạy toàn bộ test, chạy thật.
8. **Báo người dùng**: cái gì xong, kiểm bằng cách nào, cái gì chưa kiểm. Commit và
   push chỉ khi người dùng bảo.

Khi bạn bắt đầu soát bài của một worker, bật cờ để AgentwatchUI hiện hoạt ảnh trưởng
phòng đi tới bàn worker đó, và tắt khi xong:

```bash
node bin/aw.js review byteplus/deepseek-v4-pro-ga-260813 "B1 backend"
node bin/aw.js review --done
```

## 6. Việc nào giao, việc nào tự làm

| Giao cho worker | Tự làm |
|---|---|
| Hiện thực theo hợp đồng rõ ràng, có phép kiểm tự động | Hợp đồng, kiến trúc, chia việc |
| Viết test từ tiêu chí có sẵn | Quyết định khó đảo ngược |
| Vẽ sprite, CSS, mã lặp | Soát, tích hợp, chạy thật, chụp ảnh |
| Tài liệu từ mã có sẵn | Sửa nhỏ một hai dòng (giao còn tốn hơn) |
| | Mọi lệnh git ghi, cài đặt, xóa file |

## 7. Bẫy đã gặp

- **Thiếu `ARK_API_KEY`** trong shell của ứng dụng: xem mục 1.
- **Hết hạn mức 5 giờ của Coding Plan.** Worker chết giữa chừng với mã thoát 1 và dòng
  `You have exceeded the 5-hour usage quota. It will reset at <giờ>` ở cuối log. Chuyện
  này đã xảy ra sau khoảng 6 triệu token trong một buổi (bài đo model + 5 lượt worker).
  File dở dang vẫn nằm trên đĩa: kiểm tra nó chạy được không rồi mới quyết. Việc còn lại
  thì giao cho `reserve` (`opencode/big-pickle`, miễn phí, không có mắt), tự làm, hoặc
  chờ tới giờ mở lại. Đừng đo lại model khi hạn mức đang thấp: bài đo tốn token thật.
- **Model treo im lặng** (hai bản GLM): log chỉ có dòng `> build · <model>` rồi đứng.
- **Bash của Claude Code đổi `>nul` thành `>/dev/null`** khi viết file `.bat` bằng
  `printf`/heredoc. Viết file `.bat` bằng công cụ Write.
- **Đừng sửa `run-worker.sh` khi còn worker đang chạy**: bash đọc script dần dần.
- **Chi phí hiện 0**: gói Coding Plan tính theo thuê bao, opencode ghi `cost: 0`. Theo
  dõi bằng số token.
- **Heredoc dài trong lệnh Bash** dễ hỏng vì dấu nháy trong nội dung. File nhiều dòng
  thì dùng công cụ Write.
- Worker chạy với `--auto` có thể chạy lệnh bất kỳ trong thư mục dự án. Luôn đặt mốc
  `git add -A` trước, và không bao giờ cho worker chạy ở thư mục có việc chưa lưu của
  người dùng mà chưa hỏi.

## 8. Theo dõi

- `start.bat` mở AgentwatchUI: model đang làm ngồi ở bàn máy tính, model rảnh ngồi
  ghế chờ, model Claude ở góc trưởng phòng, kèm số token của từng model.
- `node bin/aw.js status`: bảng trạng thái dạng chữ.
- `.orchestra/runs.tsv`: nhật ký các lần chạy (giờ, chức vụ, model, brief, mã thoát, số giây).
- `opencode stats`: tổng token theo opencode.

## 9. Đo lại model

```bash
bash orchestra/bench/run-bench.sh byteplus/<model-mới> [model khác...]
```

In ra điểm code trên 34, số giây, và câu trả lời của bài nhìn ảnh để bạn tự chấm
(đáp án ở đầu `orchestra/bench/vision_prompt.txt`). Điểm code dưới 33 thì không giao
logic. Không trả lời được bài ảnh thì không giao việc phải nhìn.
