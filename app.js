const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const app = express();
const nodemailer = require("nodemailer");
const { json } = require("body-parser");

app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
app.use(bodyParser.json());
// views
app.set("view engine", "ejs");
app.set("views", "views");
var transporter = nodemailer.createTransport({
  host: "s1.ct8.pl",
  port: 587,
  auth: {
    user: "efaktura@rzi.ct8.pl",
    pass: "Klucze2020!3",
  },
  //debug: true, // show debug output
  logger: true, // log information in console
});
transporter.verify(function (error, success) {
  if (error) {
    console.log(error);
  } else {
    console.log("Server is ready to take our messages");
  }
});
// database connection for storing data
const connection = mysql.createConnection({
  host: "pi.cba.pl",
  user: "Bazapi2019",
  password: "Bazapi2019",
  database: "elunch_1",
});
// cookie parser
app.use(cookieParser());
connection.connect();
app.get("/", (req, res) => {
  res.render("index");
});
app.get("/verification/", (req, res) => {
  console.log("req.cookies.UserInfo.email " + req.cookies.UserInfo.email);
  console.log("req.query.email " + req.query.email);
  connection.query(
    "SELECT verify.verification FROM verify WHERE email = ?",
    req.query.email,
    (err, result) => {
      console.log("Object.keys(result).length: " + Object.keys(result).length);
      if (err) {
        console.log(err);
      } else {
        var verifyFromLink = req.query.verify;
        var verifyFromDB = result[0].verification;
        console.log("verifyFromLink " + verifyFromLink);
        console.log("verifyFromDB " + verifyFromDB);
        if (verifyFromLink == verifyFromDB) {
          activateAccount(verifyFromLink);
        } else {
          res.send("nie zgodny numer weryfikacyjny");
        }
      }
    }
  );
  function activateAccount(verifyFromLink) {
    connection.query(
      "UPDATE verify SET active = 'true' WHERE verification =?",
      verifyFromLink,
      (err, result) => {
        if (err) {
          console.log(err);
        } else {
          let userdata = {
            email: `${req.body.Email}`,
            verify: "TRUE",
          };
          res.cookie("UserInfo", userdata, { maxAge: 360000 });
          res.send(
            "<h1>Sukcess: Użytkownik został pomyślnie aktywowany</h1><br><a href='http://localhost:3000'>do strony głównej</a>"
          );
        }
      }
    );
  }
});
app.get("/dashboard", (req, res) => {
  res.render("dashboard");
});
app.get("/registration", (req, res) => {
  res.render("registration");
});
app.post("/registration", (req, res) => {
  if (req.body.Email =="" || req.body.Password =="" || req.body.Password2 =="") {
    return res.json({msg:"błąd:  Musisz wypełnić wszystkie  trzy pola"});
  }

  var verify = Math.floor(Math.random() * 10000000 + 1);
  var userData = {
    email: req.body.Email,
    password: req.body.Password,
    verification: verify,
  };
  
  bcrypt.genSalt(10, function (err, salt) {
    bcrypt.hash(req.body.Password, salt, function (err, hash) {
      console.log("req.body.Email : " + req.body.Email);
      if (err) {
        console.log(err);
      } else {
        connection.query(
          "SELECT * FROM verify WHERE email = ?",
          req.body.Email,
          (err, result) => {
            if (err) {
              console.log("dane błędu wybierania z DB: " + JSON.stringify(err));
              return res.json({
                msg: "ERROR: dane błędu wybierania z DB",
              });
            } else {
              console.log("result[0].length: " + JSON.stringify(result.length));
              console.log("result[0].email: " + JSON.stringify(result));
              if (result.length > 0) {
                if (result[0].active == "true"){
                  return res.json({
                    msg: "email już istnieje w DB i jest już aktywowany",
                  });
                } else {
                  return res.json({
                    msg: "email istnieje w DB ale nie jest aktywowany <br> sprawdź swoją skrzynkę pocztową i aktywuj rejestracje",
                  });
                }
                
              } else {
                Store(hash);
              }
            }
          }
        );
      }
    });
  });
  // verification
  function Store(pass) {
    var mailOption = {
      from: "efaktura@rzi.ct8.pl", // sender this is your email here
      to: `${req.body.Email}`, // receiver email2
      subject: "Weryfikacja konta w serwisie efaktura",
      html: `<h1>Cześć, kliknij na link <h1><br><p> Link aktywacyjny.</p>
        <br><a href="http://localhost:3000/verification/?verify=${verify}&email=${req.body.Email}">Kliknij aby aktywować twoje konto w serwisie efaktura.ct8.pl</a>`,
    };
    // store data
    userData.password = pass;
    connection.query("INSERT INTO verify SET ?", userData, (err, result) => {
      if (err) {
        console.log(err);
      } else {
        transporter.sendMail(mailOption, (error, info) => {
          if (error) {
            console.log(error);
            res.json({msg: error.response}
            );

          } else {
            let userdata = {
              email: `${req.body.Email}`,
            };
            res.cookie("UserInfo", userdata, { maxAge: 360000 });
            res.json({msg: "Mail z linkiem aktywacyjnym został wysłany <br> przedź do swojej skrzynki pocztowej i aktywuj konto"}              
            );
            console.log("Your Mail Send Successfully");
          }
        });
        console.log("Data Successfully insert");
      }
    });
  }
});
app.get("/login", (req, res) => {
  res.render("login");
});
app.post("/login", (req, res) => {
  var email = req.body.Email;
  var pass = req.body.Password;

  connection.query(
    "SELECT * FROM verify WHERE email = ?",
    email,
    (err, result) => {
      if (err) {
        //console.log(err);
        console.log("dane błędu: " + JSON.stringify(err));
        return res.json({
          msg: "ERROR",
        });
      } else {
        console.log("result.length: " + result.length);
        if (result.length > 0) {
          var hash = result[0].password;
          var active = result[0].active;
          console.log("hash: " + hash);
          console.log("active: " + active);
          if (active == "true") {
            bcrypt.compare(pass, hash, function (err, res) {
              if (err) {
                return res.json({
                  msg: "ERROR",
                });
              }
              if (res) {
                console.log("succes");
                LoginSuccess();
              } else {
                LoginFailed();
                console.log("failed");
              }
            });
          } else {
            return res.json({
              msg: "email nie aktywowany",
            });
          }
        } else {
          console.log("result.length: " + result.length);
          return res.json({
            msg: "nie ma takiego adresu email w DB",
          });
        }
      }
    }
  );

  function LoginSuccess() {
    let userdata = {
      email: `${req.body.Email}`,
      verify: "TRUE",
      msg: ""
    };
    res.cookie("UserInfo", userdata, { maxAge: 360000 });
    res.json({
      verify: "true",
      msg: "Sukcess"
    });
  }
  function LoginFailed() {
    let userdata = {
      email: `${req.body.Email}`,
      verify: "FALSE",
    };
    res.cookie("UserInfo", userdata, { maxAge: 360000 });
    res.json({
      verify: "false",
      msg: "Nie udało się zalogować, sprawdź hasło"
    });
  }
});
app.get("/reset", (req, res) => {
  // after click reset activation link from mail
  console.log("req.query.code: " + req.query.code);
  console.log("req.query.email: " + req.query.email);
  if (req.query.code) {
    var sql = "SELECT * FROM verify WHERE email=?";
    console.log("sql " + sql);

    connection.query(sql, req.query.email, (err, result) => {
      console.log("result[0].email " + result[0].email);
      if (result[0].email == req.query.email) {
        console.log("result");
        return res.render("newPassword", {
          email: result[0].email,
          code: req.query.code,
        });
      }
    });
  } else {
    res.render("reset");
  }
});
app.post("/reset", (req, res) => {
  if (req.body.Email ==undefined || req.body.Email == ""){
    res.json({
      msg: "Wprowadź poprawny email"
    });
  }  
  connection.query(
    "SELECT verify.email, verify.active FROM verify WHERE email = ?",
    req.body.Email,
    (err, result) => {
      if (result.length >0) {
        console.log("result: passwordReset");
        console.log("email " + result[0].email);
        console.log("status " + result[0].active);
        if (result[0].active == "true") {
          passwordReset(result[0].email, result[0].active);
        } else {
          res.json({
            msg:
              "ten email nie jest aktywowany w bazie , najpierw się zarejestruj i aktywuj ",
          });
        }
      } else {
        res.json({
          msg: "błąd: nie istnieje email w bazie danych",
        });
      }

      function passwordReset(email, status) {
        console.log("fn: passwordReset");
        console.log("email " + email);
        console.log("status " + status);
        var code = Math.floor(Math.random() * 10000000 + 1);

        var mailOption = {
          from: "efaktura@rzi.ct8.pl", // sender this is your email here
          to: `${req.body.Email}`, // receiver email2
          subject: "reset hasła w serwisie efaktura",
          html: `<h2>Cześć, kliknij na link aby zresetować hasło <h2>
        <br><a href="http://localhost:3000/reset/?code=${code}&email=${req.body.Email}">Kliknij tutaj </a>`,
        };
        transporter.sendMail(mailOption, (error, info) => {
          if (error) {
            console.log(error);
          } else {
            res.json({
              msg: "link do resetu hasła został wysłany na twój email",
            });
          }
        });
      }
    }
  );
});
app.post("/newpassword", (req, res) => {
  if (
    !req.body.Email ||
    !req.body.Password ||
    !req.body.Password2 ||
    !req.body.code
  ) {
    return res.json("błąd:  Musisz wypełnić wszystkie pola");
  }

  // verification
  function Store(pass) {
    var verify = req.body.code;

    var mailOption = {
      from: "efaktura@rzi.ct8.pl", // sender this is your email here
      to: `${req.body.Email}`, // receiver email2
      subject: "Zniana hasła w serwisie efaktura",
      html: `<h1>Właśnie zostało zmienione hasło w serwisie efaktura. Jeśli to nie ty zmieniłeś zgłoś to do administratora systemu<h1>`,
    };
    // store data

    var userData = {
      email: req.body.Email,
      password: pass,
      verification: verify,
    };

    connection.query("UPDATE verify SET ?", userData, (err, result) => {
      if (err) {
        console.log(err);
      } else {
        transporter.sendMail(mailOption, (error, info) => {
          if (error) {
            console.log(error);
          } else {
            let userdata = {
              email: `${req.body.Email}`,
            };
            res.cookie("UserInfo", userdata, { maxAge: 360000 });
            res.json("Hasło do twojego konta zostało zmienione konto");
            console.log("Your Mail Send Successfully");
          }
        });

        console.log("Data Successfully insert");
      }
    });
  }
  bcrypt.genSalt(10, function (err, salt) {
    bcrypt.hash(req.body.Password, salt, function (err, hash) {
      if (err) {
        console.log(err);
      } else {
        Store(hash);
      }
    });
  });
});
app.listen(3000);
