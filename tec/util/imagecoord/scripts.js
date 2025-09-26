var URL = window.URL;
var cvs = document.getElementById("canvas");
var ctx = cvs.getContext("2d");
var res = document.getElementById("results");
var count = 0;

cvs.addEventListener("mousemove", mousePos, false);
cvs.addEventListener("click", copyMousePos, false);

window.onload = function () {
  var inputImage = document.getElementById("inputImage");
  var fileDiv = document.getElementById("file");
  inputImage.addEventListener("change", handleImageFiles, false);
  file.style.visibility = "hidden";
};

function copyMousePos(evt) {
  var rect = cvs.getBoundingClientRect();
  var x = parseInt(evt.clientX - rect.left);
  var y = parseInt(evt.clientY - rect.top);
  var name = document.getElementById("currentItemName").value;
  var storeValue = document.getElementById("store").value;
  var storeId = document.getElementById("store");

  copyText = x + "," + y;
  navigator.clipboard.writeText(copyText);

  storeId.value =
    storeValue + name + "," + count + "," + x + "," + y + "~~";
  count = count + 1;
}

function mousePos(evt) {
  var rect = cvs.getBoundingClientRect();
  var x = parseInt(evt.clientX - rect.left);
  var y = parseInt(evt.clientY - rect.top);
  var p = ctx.getImageData(x, y, 1, 1).data;
  results.innerHTML = `X: ${x} | Y: ${y} | R:${p[0]} G:${p[1]} B:${p[2]} A:${p[3]}`;
}

function displayOutput() {
  var parseStore = document.getElementById("store").value;
  var outputTo = document.getElementById("output");
  var fileDiv = document.getElementById("file");
  var previewContainer = document.getElementById("previewTableContainer");

  // Prepare CSV string
  parseStore = parseStore.replaceAll("~~", "\n");
  outputTo.value = "Name,Path,X,Y\n" + parseStore;

  // Build table preview
  var rows = outputTo.value.trim().split("\n");
  var tableHTML = "<table class='previewTable'>";
  rows.forEach((row, idx) => {
    var cols = row.split(",");
    tableHTML += "<tr>";
    cols.forEach((col) => {
      if (idx === 0) {
        tableHTML += "<th>" + col + "</th>";
      } else {
        tableHTML += "<td>" + col + "</td>";
      }
    });
    tableHTML += "</tr>";
  });
  tableHTML += "</table>";

  previewContainer.innerHTML = tableHTML;
  file.style.visibility = "visible";
}

function download() {
  var pom = document.createElement("a");
  var filename = document.getElementById("fileName").value;
  var text = document.getElementById("output").value;
  filename = filename + ".csv";
  pom.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  pom.setAttribute("download", filename);
  pom.style.display = "none";
  document.body.appendChild(pom);
  pom.click();
  document.body.removeChild(pom);
}

function handleImageFiles(e) {
  var url = URL.createObjectURL(e.target.files[0]);
  var img = new Image();
  img.onload = function () {
    cvs.width = img.width;
    cvs.height = img.height;
    ctx.drawImage(img, 0, 0);
  };
  img.src = url;
}

function resetCount() {
  count = 0;
}