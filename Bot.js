const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const schedule = require("node-schedule");
const CronJob = require("cron").CronJob;

class SiTebi {
  CHATSSTOREPATH = "./chatStore.json";
  SESSIONPATH = "./session.json";
  fiveMinute = 300000;
  eightMinute = 480000;
  chats = {};
  clientRemenderObat = {};

  constructor() {
    if (fs.existsSync(this.CHATSSTOREPATH)) {
      this.chats = require(this.CHATSSTOREPATH);
    }
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        ignoreDefaultArgs: ["--disable-extensions"],
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process", // <- this one doesn't works in Windows
          "--disable-gpu",
        ],
      },
    });

    this.note = JSON.parse(fs.readFileSync("./text_note.json"));
    this.init();
    this.remenderObat();
  }

  cleanInputUSer(input) {
    return input.replace(/[^a-zA-Z0-9 ]/g, "").toLowerCase();
  }

  ScheduleMessage1(sender, username) {
    this.client.sendMessage(
      sender,
      `Hallo ${username}, apakah anda ingin melanjutkan Pendaftaran ? `
    );
    this.client.sendMessage(
      sender,
      `Jika 5 menit tidak ada respon dari Bapak/Ibu, Maka sesi percakapan akan otomatis berakhir sehingga harus mengulang pendaftaran kembali.`
    );
  }
  ScheduleMessage2(sender) {
    this.client.sendMessage(
      sender,
      `Terimakasih Telah Mengunakan Layanan Si Tebi. Salam Sehat Selalu!  `
    );
  }

  initialSender(sender, username, chats) {
    if (!(sender in chats)) {
      chats[sender] = {
        session: "1",
        username,
        number: sender,
        skoring: 0,
        job1: schedule.scheduleJob(
          new Date(new Date().getTime() + this.fiveMinute),
          () => {
            this.ScheduleMessage1(sender, username);
          }
        ),
        job2: schedule.scheduleJob(
          new Date(new Date().getTime() + this.eightMinute),
          () => {
            delete chats[sender];
            this.ScheduleMessage2(sender);
          }
        ),
      };
    }
  }

  saveChats(chats) {
    // save chats to file json
    // fs.writeFileSync(this.CHATSSTOREPATH, JSON.stringify(chats));
  }

  saveSession() {
    this.client.saveAuthInfo(this.SESSIONPATH);
  }

  loadSession() {
    if (fs.existsSync(this.SESSIONPATH)) {
      this.client.loadAuthInfo(this.SESSIONPATH);
    }
  }

  changeSession(sender, session) {
    try {
      this.chats[sender].session = session;
      this.chats[sender].job1.reschedule(
        new Date(new Date().getTime() + this.fiveMinute)
      );
      this.chats[sender].job2.reschedule(
        new Date(new Date().getTime() + this.eightMinute)
      );
    } catch (error) {
      this.chats[sender] = {
        session: "1",
        number: sender,
        skoring: 0,
        job1: schedule.scheduleJob(
          new Date(new Date().getTime() + this.fiveMinute),
          function () {
            this.ScheduleMessage1(sender, username);
          }
        ),
        job2: schedule.scheduleJob(
          new Date(new Date().getTime() + this.eightMinute),
          function () {
            delete chats[sender];
            ScheduleMessage2(sender);
          }
        ),
      };
      this.sessionFirst(sender, "");
    }
  }
  endSession(sender) {
    this.chats[sender].job1.cancel();
    this.chats[sender].job2.cancel();
    delete this.chats[sender];
    this.saveChats(this.chats);
  }

  sessionFirst(sender, username) {
    this.changeSession(sender, "2");
    this.client.sendMessage(
      sender,
      `Halo, ${username}. Selamat datang di Informasi layanan Tuberkulosis Paru Puskesmas Singandaru.`
    );
    this.client.sendMessage(
      sender,
      `Silahkan pilih menu yang tersedia dengan mengetikkan angka yang tersedia di menu.`
    );
    this.client.sendMessage(sender, this.note.menu);
  }
  remenderObat() {
    // shudule job send message to client every day at 7 am timezone asia/jakarta
    const job = new CronJob(
      "0 0 7 * * *",
      () => {
        for (const key in this.clientRemenderObat) {
          if (this.clientRemenderObat[key] > 0) {
            this.note.laporan_minum_obat.greating.forEach((i) => {
              this.client.sendMessage(key, i);
            });
            this.clientRemenderObat[key] -= 1;
          } else {
            delete this.clientRemenderObat[key];
          }
        }
      },
      null,
      true,
      "Asia/Jakarta"
    );
    job.start();
  }

  infoTb(sender) {
    this.note.infoTB.forEach((element) => {
      this.client.sendMessage(sender, element);
    });
    this.PertanyaanTerakhirTb(sender);
  }

  laporanMinumObat(sender) {
    this.changeSession(sender, "4");
    this.client.sendMessage(sender, this.note.laporan_minum_obat.pertanyaan1);
  }
  confirmRemenderMinumObat(sender, input) {
    const text = `Si Tebi akan mengingatkan ${this.chats[sender].username} untuk meminum obat setiap jam 7 pagi selama ${input} hari kedepan.`;
    this.client.sendMessage(sender, text);
    this.clientRemenderObat[sender] = input;
    this.PertanyaanTerakhirTb(sender);
  }

  janjiPengambilanObat(sender) {
    this.client.sendMessage(sender, this.note.janji_pengambilan_obat);
    this.PertanyaanTerakhirTb(sender);
  }
  janjKonselingTB(sender) {
    this.client.sendMessage(sender, this.note.janji_konseling_tb);
    this.PertanyaanTerakhirTb(sender);
  }
  buatLaporanTb(sender) {
    this.client.sendMessage(sender, this.note.laporan_orang_terduga_tb);
    this.PertanyaanTerakhirTb(sender);
  }
  buatLaporanTbAnak(sender) {
    this.client.sendMessage(sender, this.note.laporan_anak_terduga_tb);
    this.PertanyaanTerakhirTb(sender);
  }
  obatKhususResisObat(sender) {
    this.note.khusus_tb_resisten_obat.forEach((i) => {
      this.client.sendMessage(sender, i);
    });
    this.PertanyaanTerakhirTb(sender);
  }
  caraminumObat(sender) {
    this.client.sendMessage(sender, this.note.cara_minum_obat);
    this.PertanyaanTerakhirTb(sender);
  }
  pengecegahanTbAnak(sender) {
    this.client.sendMessage(sender, this.note.pencegahanTbAnak);
    this.PertanyaanTerakhirTb(sender);
  }

  skoringTbPertanyaan1(sender) {
    this.changeSession(sender, "3.1");
    this.client.sendMessage(sender, "Skoring TB anak!");
    this.client.sendMessage(sender, "Berikut ini akan ada pertanyaan:");
    this.client.sendMessage(sender, this.note.skoring_tb_anak.pertanyaan1);
  }
  skoringTbPertanyaan2(sender) {
    this.changeSession(sender, "3.2");
    this.client.sendMessage(sender, this.note.skoring_tb_anak.pertanyaan2);
  }
  skoringTbPertanyaan3(sender) {
    this.changeSession(sender, "3.3");
    this.client.sendMessage(sender, this.note.skoring_tb_anak.pertanyaan3);
  }
  skoringTbPertanyaan4(sender) {
    this.changeSession(sender, "3.4");
    this.client.sendMessage(sender, this.note.skoring_tb_anak.pertanyaan4);
  }
  skoringTbPertanyaan5(sender) {
    this.changeSession(sender, "3.5");
    this.client.sendMessage(sender, this.note.skoring_tb_anak.pertanyaan5);
  }
  skoringTbPertanyaan6(sender) {
    this.changeSession(sender, "3.6");
    this.client.sendMessage(sender, this.note.skoring_tb_anak.pertanyaan6);
  }
  skoringTbPertanyaan7(sender) {
    this.changeSession(sender, "3.7");
    this.client.sendMessage(sender, this.note.skoring_tb_anak.pertanyaan7);
  }
  skoringTbPertanyaan8(sender) {
    this.changeSession(sender, "3.8");
    this.client.sendMessage(sender, this.note.skoring_tb_anak.pertanyaan8);
  }
  skoringTbNegatif(sender, skoring) {
    const text = `Hasil Skoring TB Anak sebagai berikut:\n*Negatif*\nDengan Skor *${skoring}*\nKemungkinan besar anak anda tidak terinfeksi TB.`;
    this.client.sendMessage(sender, text);
    this.PertanyaanTerakhirTb(sender);
  }
  skoringTbPositif(sender, skoring) {
    const text = `Hasil Skoring TB Anak sebagai berikut:\n*Positif*\nDengan Skor *${skoring}*\nKemungkinan besar anak anda terinfeksi TB. Harap segera laporkan ke puskesmas agar dapat segera diberikan pengobatan.`;
    this.client.sendMessage(sender, text);
    this.PertanyaanTerakhirTb(sender);
  }
  PertanyaanTerakhirTb(sender) {
    this.changeSession(sender, "0");
    this.client.sendMessage(
      sender,
      "apakah kamu masih ingin berinteraksi dengan si Tebi ? ketik (1 atau 2)\n1. untuk melanjutkan\n2. untuk mengakhiri sesi"
    );
  }

  init() {
    console.log("Bot WhatsApp is running...");

    this.client.initialize();

    this.client.on("qr", (qr) => {
      // NOTE: This event will not be fired else if a session is specified.
      qrcode.generate(qr, { small: true });
    });

    this.client.on("authenticated", () => {
      console.log("AUTHENTICATED");
    });

    this.client.on("auth_failure", (msg) => {
      // Fired else if session restore was unsuccessful
      console.error("AUTHENTICATION FAILURE", msg);
    });
    this.client.on("ready", () => {
      console.log("READY");
    });

    this.client.on("message", async (msg) => {
      // variable untuk menyimpan pesan yang dikirim oleh user
      const sender = msg.from;
      const username = msg._data.notifyName;
      const input = this.cleanInputUSer(msg.body);
      // initial session client
      this.initialSender(sender, username, this.chats);
      const chats = this.chats[sender];

      if (chats.session === "1") {
        this.sessionFirst(sender, username);
      } else if (chats.session === "2") {
        if (input === "1") {
          this.infoTb(sender);
        } else if (input === "2") {
          this.laporanMinumObat(sender);
        } else if (input === "3") {
          this.janjiPengambilanObat(sender);
        } else if (input === "4") {
          this.janjKonselingTB(sender);
        } else if (input === "5") {
          this.skoringTbPertanyaan1(sender);
        } else if (input === "6") {
          this.buatLaporanTb(sender);
        } else if (input === "7") {
          this.buatLaporanTbAnak(sender);
        } else if (input === "8") {
          this.obatKhususResisObat(sender);
        } else if (input === "9") {
          this.caraminumObat(sender);
        } else if (input === "10") {
          this.pengecegahanTbAnak(sender);
        } else {
          this.client.sendMessage(
            sender,
            "Maaf, menu yang anda pilih tidak tersedia. (ketik angka 1-10):"
          );
          this.client.sendMessage(sender, this.note.menu);
        }
      } else if (chats.session.startsWith("3")) {
        // skoring session
        if (chats.session === "3.1") {
          if (input === "1") {
            chats.skoring += 0;
            this.skoringTbPertanyaan2(sender);
          } else if (input === "2") {
            chats.skoring += 2;
            this.skoringTbPertanyaan2(sender);
          } else if (input === "3") {
            chats.skoring += 3;
            this.skoringTbPertanyaan2(sender);
          } else {
            this.client.sendMessage(
              sender,
              "Maaf, input yang anda masukkan salah. (ketik angka 1-3):"
            );
            this.skoringTbPertanyaan1(sender);
          }
        } else if (chats.session === "3.2") {
          if (input === "1") {
            chats.skoring += 0;
            this.skoringTbPertanyaan3(sender);
          } else if (input === "2") {
            chats.skoring += 2;
            this.skoringTbPertanyaan3(sender);
          } else {
            this.client.sendMessage(
              sender,
              "Maaf, input yang anda masukkan salah. (ketik angka 1-2):"
            );
            this.skoringTbPertanyaan2(sender);
          }
        } else if (chats.session === "3.3") {
          if (input === "1") {
            chats.skoring += 1;
            this.skoringTbPertanyaan4(sender);
          } else if (input === "2") {
            chats.skoring += 2;
            this.skoringTbPertanyaan4(sender);
          } else {
            this.client.sendMessage(
              sender,
              "Maaf, input yang anda masukkan salah. (ketik angka 1-2):"
            );
            this.skoringTbPertanyaan3(sender);
          }
        } else if (chats.session === "3.4") {
          if (input === "1") {
            chats.skoring += 1;
            this.skoringTbPertanyaan5(sender);
          } else if (input === "2") {
            chats.skoring += 0;
            this.skoringTbPertanyaan5(sender);
          } else {
            this.client.sendMessage(
              sender,
              "Maaf, input yang anda masukkan salah. (ketik angka 1-2):"
            );
            this.skoringTbPertanyaan4(sender);
          }
        } else if (chats.session === "3.5") {
          if (input === "1") {
            chats.skoring += 1;
            this.skoringTbPertanyaan6(sender);
          } else if (input === "2") {
            chats.skoring += 0;
            this.skoringTbPertanyaan6(sender);
          } else {
            this.client.sendMessage(
              sender,
              "Maaf, input yang anda masukkan salah. (ketik angka 1-2):"
            );
            this.skoringTbPertanyaan5(sender);
          }
        } else if (chats.session === "3.6") {
          if (input === "1") {
            chats.skoring += 1;
            this.skoringTbPertanyaan7(sender);
          } else if (input === "2") {
            chats.skoring += 0;
            this.skoringTbPertanyaan7(sender);
          } else {
            this.client.sendMessage(
              sender,
              "Maaf, input yang anda masukkan salah. (ketik angka 1-3):"
            );
            this.skoringTbPertanyaan6(sender);
          }
        } else if (chats.session === "3.7") {
          if (input === "1") {
            chats.skoring += 1;
            this.skoringTbPertanyaan8(sender);
          } else if (input === "2") {
            chats.skoring += 0;
            this.skoringTbPertanyaan8(sender);
          } else {
            this.client.sendMessage(
              sender,
              "Maaf, input yang anda masukkan salah. (ketik angka 1-2):"
            );
            this.skoringTbPertanyaan7(sender);
          }
        } else if (chats.session === "3.8") {
          if (input === "1") {
            chats.skoring += 1;
            if (chats.skoring >= 6) {
              this.skoringTbPositif(sender, chats.skoring);
              chats.skoring = 0;
            } else {
              this.skoringTbNegatif(sender, chats.skoring);
              chats.skoring = 0;
            }
          } else if (input === "2") {
            chats.skoring += 0;
            if (chats.skoring >= 6) {
              this.skoringTbPositif(sender, chats.skoring);
              chats.skoring = 0;
            } else {
              this.skoringTbNegatif(sender, chats.skoring);
              chats.skoring = 0;
            }
          } else {
            this.client.sendMessage(
              sender,
              "Maaf, input yang anda masukkan salah. (ketik angka 1-3):"
            );
            this.skoringTbPertanyaan8(sender);
          }
        }
      } else if (chats.session === "4") {
        // input between 1-14
        const inputNum = parseInt(input);
        if (inputNum >= 1 && inputNum <= 14) {
          // convert to number
          this.confirmRemenderMinumObat(sender, inputNum);
        } else if (input == "0" || input == 0) {
          this.PertanyaanTerakhirTb(sender);
        } else {
          this.client.sendMessage(
            sender,
            "Maaf, input yang anda masukkan salah. (ketik angka 1-14):"
          );
        }
      } else if (chats.session === "0") {
        if (input === "1") {
          this.sessionFirst(sender, username);
        } else if (input === "2") {
          this.endSession(sender);
          this.client.sendMessage(
            sender,
            "Terimakasih Telah Menggunakan Layanan Si Tebi. Salam Sehat Selalu!"
          );
        } else {
          this.client.sendMessage(
            sender,
            "Maaf, input yang anda masukkan salah untuk mengakhiri sesi. (ketik 1 atau 2):"
          );
        }
      }
    });
  }
}

module.exports = SiTebi;
