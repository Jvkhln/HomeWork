# Google Sheets & Google Apps Script Backend Тохируулах Заавар

Энэхүү систем нь Google Sheets-ийг үнэгүй, найдвартай реляцийн бус өгөгдлийн сан болгон ашиглаж, Google Apps Script Web App-аар дамжуулан бодит цагт ажиллана.

---

## АЛХАМ 1: Google Sheets Үүсгэх

1. Өөрийн Google бүртгэлээр нэвтэрч [Google Drive](https://drive.google.com) руу орно.
2. **New (Шинэ)** -> **Google Sheets (Хүснэгт)** сонгож шинэ хүснэгт үүсгэнэ.
3. Хүснэгтийн нэрийг: `Гэрийн даалгаврын систем - Өгөгдлийн сан` гэж өгнө.

---

## АЛХАМ 2: Apps Script Кодыг оруулах

1. Google Sheets-ийн цэснээс: **Extensions (Өргөтгөлүүд)** -> **Apps Script** сонгоно.
2. Гарч ирсэн `Code.gs` файлын доторх кодыг арилгаж, манай төслийн `/apps-script/Code.gs` файлын кодыг бүрэн хуулж тавина (`Ctrl+A`, `Ctrl+V`).
3. Скриптийн дээр байрлах **Save (Хадгалах)** дүрсийг дарна (`Ctrl+S`).

---

## АЛХАМ 3: Анхны бүтэц (Sheets)-ийг бэлтгэх

Apps Script цонхон дээр:
1. Дээрх функц сонгох хэсгээс `initAllSheets` гэсэн функцийг сонгоно.
2. **Run (Ажиллуулах)** товчийг дарна.
3. Google танаас "Review Permissions" шаардах бөгөөд:
   - Өөрийн Google бүртгэлийг сонгоно.
   - "Advanced" -> "Go to Untitled project (unsafe)" дарна.
   - "Allow" дарж зөвшөөрнө.
4. Ажиллуулж дууссаны дараа таны Google Sheets дотор дараах 8 sheet автоматаар үүснэ:
   - `Users`
   - `Students`
   - `Schedule`
   - `Homework`
   - `Submissions`
   - `Leaders`
   - `Settings`
   - `AuditLog`

---

## АЛХАМ 4: Анхны Багшийн Хэрэглэгч үүсгэх

`Users` sheet-ийн 2-р мөрөнд дараах утгуудыг гараар эсвэл веб системийн демоноос оруулж болно:
- `userId`: `u_teacher1`
- `username`: `teacher1`
- `passwordHash`: `password123` *(эсвэл систем автоматаар хэшлэнэ)*
- `role`: `TEACHER`
- `studentId`: *(хоосон)*
- `active`: `TRUE`
- `displayName`: `Багш Энхжаргал`
- `createdAt`: `2026-01-01T00:00:00Z`

---

## АЛХАМ 5: Web App болгон Deploy хийх

1. Apps Script цонхны баруун дээд булан дахь хөх өнгийн **Deploy** товчийг дарна.
2. **New deployment** сонгоно.
3. Зүүн талын арааны дүрс (Select type) -> **Web app** сонгоно.
4. Тохиргоо:
   - **Description**: `Гэрийн даалгаврын API v1`
   - **Execute as**: `Me (таны_мэйл@gmail.com)`
   - **Who has access**: `Anyone` *(Хэн ч хандаж болох бөгөөд эрхийг скрипт өөрөө дотроо шалгана)*
5. **Deploy** товчийг дарна.
6. Гарч ирсэн **Web app URL**-ийг хуулж авна (Жишээ: `https://script.google.com/macros/s/.../exec`).

---

## АЛХАМ 6: Веб Системд Холбох

1. Веб аппликейшний баруун дээд буланд байрлах **"Google Sheets Холболт"** товчийг дарна.
2. Хуулж авсан **Web App URL**-ээ оруулна.
3. **"Холболт шалгах & Холбох"** товчийг дарна.
4. Амжилттай холбогдсон тохиолдолд систем "Бодит Google Sheets холболт" горимд шилжиж, бүх бүртгэл шууд таны Google Sheets дээр хадгалагдах болно!
