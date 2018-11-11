const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");

const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const methodOverride = require("method-override");

const app = express();
//view engine

//MW
app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(methodOverride("_method"));

//Mongo setup
const mongoURI = "mongodb://test:testTEST1@ds141872.mlab.com:41872/file_upload";
const connection = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true
});

let gfs;
connection.once("open", () => {
  gfs = Grid(connection.db, mongoose.mongo);
  gfs.collection("uploads");
});

const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads"
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if (!files || files.length == 0) {
      res.render("index", { files: false });
    } else {
      files.map(file => {
        if (
          file.contentType === "image/jpeg" ||
          file.contentType === "image/png"
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      // console.log(files);
      res.render("index", { files: files });
    }
    // return res.json(files);
  });
});

//upload file to gfs and redirect to home
app.post("/upload", upload.single("file"), (req, res) => {
  //   res.json({ file: req.file });
  res.redirect("/");
});

//get all files
app.get("/files", (req, res) => {
  gfs.files.find().toArray((err, files) => {
    if (!files || files.length == 0) {
      return res.status(404).send("No Files Exist");
    }
    return res.json(files);
  });
});

//get single file
app.get("/file/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length == 0) {
      return res.status(404).send("File Not Found");
    } else {
      return res.json(file);
    }
  });
});

//get single image
app.get("/image/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).send("File Not Found");
    }
    if (file.contentType == "image/jpeg" || file.contentType == "image/png") {
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      return res.status(404).send("Not an Image");
    }
  });
});

//delete image
app.delete("/file/:fileId", (req, res) => {
  gfs.remove({ _id: req.params.fileId, root: "uploads" }, (err, gridStore) => {
    if (err) {
      return res.status(404).send(err);
    } else {
      res.redirect("/");
    }
  });
});

//deploy
app.use(express.static(path.join(__dirname, "views")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "views/index.ejs"));
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`server listening on port ${port}.`);
});
