const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const app = express();
const nodemailer = require("nodemailer");
const fetch = require("node-fetch");

// parser for forms undefined problem when submit form
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
  host: "smtp.wp.pl",
  port: 587,
  auth: {
    user: "rafal_zietak@wp.pl",
    pass: "Klucze2019!",
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

// this is for registration
app.post("/registration", (req, res) => {
  // verification
  function Store(pass) {
    var verify = Math.floor(Math.random() * 10000000 + 1);

    var mailOption = {
      from: "rafal_zietak@wp.pl", // sender this is your email here
      to: `${req.body.Email}`, // receiver email2
      subject: "Weryfikacja konta wserwisie efaktura",
      html: `<h1>Cześć, kliknij na link <h1><br><hr><p> Link aktywacyjny.</p>
        <br><a href="http://localhost:3000/verification/?verify=${verify}">Kliknij aby aktywować twoje konto w serwisie efaktura.ct8.pl</a>`,
    };
    // store data

    var userData = {
      email: req.body.Email,
      password: pass,
      verification: verify,
    };

    connection.query("INSERT INTO verify SET ?", userData, (err, result) => {
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
            res.cookie("UserInfo", userdata);
            res.json(
              "Mail z linkiem aktywacyjnym został wysłany, przedź do swojej skrzynki pocztowej i aktywuj konto"
            );
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

// verification
app.get("/verification/", (req, res) => {
  function activateAccount(verification) {
    if (verification == req.query.verify) {
      connection.query(
        "UPDATE verify SET active = ?",
        "true",
        (err, result) => {
          if (err) {
            console.log(err);
          } else {
            let userdata = {
              email: `${req.body.Email}`,
              verify: "TRUE",
            };
            res.cookie("UserInfo", userdata);
            res.send("<h1>Sukcess: Użytkownik został pomyślnie aktywowany</h1>");
          }
        }
      );
    } else {
      res.send("<h1>błąd aktywacji: nie zgodny adres email</h1>");
    }
  }
  console.log("req.cookies.UserInfo.email " + req.cookies.UserInfo.email);
  connection.query(
    "SELECT verify.verification FROM verify WHERE email = ?",
    req.cookies.UserInfo.email,
    (err, result) => {
      if (err) {
        console.log(err);
      } else {
        var verify1 = req.query.verify;
        var verify2 = result[0].verification;
        if (verify1 == verify2) {
          activateAccount(result[0].verification);
        } else {
          res.send("<h1>Błąd rejestracji: Użytkownik o podanym adresie email już istnieje, nie można ponownie zarejestrować uzytkownika o takim samym emailu<br>Jeśłi zapomniałeś hasło kliknij w link reset hasła</h1>");
        }
      }
    }
  );
});

app.get("/dashboard", (req, res) => {
  res.render("dashboard");
});

app.get("/login", (req, res) => {
  res.render("login");
});


app.get("/registration", (req, res) => {
  res.render("registration");
});

app.post("/login", (req, res) => {
  var email = req.body.Email;
  var pass = req.body.Password;

  function LoginSuccess() {
    let userdata = {
      email: `${req.body.Email}`,
      verify: "TRUE",
    };
    res.cookie("UserInfo", userdata);
    res.json({
      verify: "true",
    });
  }
  connection.query(
    "SELECT * FROM verify WHERE email = ?",
    email,
    (err, result) => {
      if (err) {
        console.log(err);
      } else {
        var hash = result[0].password;
        console.log("hash" + hash)
        bcrypt.compare(pass, hash, function (err, res) {
          if (err) {
            res.json({
              msg: "ERROR",
            });
          } else {
            LoginSuccess();
          }
        });
      }
    }
  );
});

app.listen(3000);