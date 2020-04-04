// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const {remote, ipcRenderer} = require('electron');
var dialog = remote.dialog;
var app = remote.app;
var $ = jQuery = require('jquery')
var fs = require('fs');
var path = require('path');
require('jquery-ui-dist/jquery-ui')

var globalVariable = {};

//Panels Infos and methods
var panels = {
  getAllState : function(array){
    var state = 0;
    for(var panel of array){
      state += parseInt(panels[panel].getState(), 10)
    }
    return state;
  },
  optionalField : {
    getState : function(){
      return $(".optional-field").css("z-index") ? 1 : 0;
    }
  },
  afterResult : {
    getState : function(){
      return $(".after-result").css("z-index") ? 1 : 0;
    }
  },
  loading : {
    setMain : async function(){
      $("#progressbar").css("width", "0%");
      if(panels.getAllState(["upload", "error", "result", "afterResult", "optionalField"])) {
        await $("#upload, #error, #result, .after-result, .optional-field").css({"z-index" : "0", "pointer-events" : "none"}).animate({opacity:0}, 500).promise();
      }
      $(".optional-field").fadeOut(500);
      $("#loading").css({"z-index" : "1", "pointer-events" : "all"}).animate({opacity:1}, 500);
      globalVariable = {};
    },
    getState : function(){
      return $("#loading").css("z-index") ? 1 : 0;
    }
  },
  upload : {
    setMain : async function(optionalField){
      if(optionalField) {
        if(panels.getAllState(["loading", "error", "result", "afterResult"])) {
          await $("#loading, #error, #result, .after-result").css({"z-index" : "0", "pointer-events" : "none"}).animate({opacity:0}, 500).promise();
        }
        $(".optional-field").fadeIn(500);
        $("#upload, .optional-field").css({"z-index" : "1", "pointer-events" : "all"}).animate({opacity:1}, 500);
      }
      else {
        if(panels.getAllState(["loading", "error", "result", "afterResult", "optionalField"])) {
          await $("#loading, #error, #result, .after-result, .optional-field").css({"z-index" : "0", "pointer-events" : "none"}).animate({opacity:0}, 500).promise();
        }
        $(".optional-field").fadeOut(500);
        $("#upload").css({"z-index" : "1", "pointer-events" : "all"}).animate({opacity:1}, 500);
      }
      globalVariable = {};
    },
    getState : function(){
      return $("#upload").css("z-index") ? 1 : 0;
    }
  },
  error : {
    setMain : async function(){
      if(panels.getAllState(["loading", "upload", "result", "afterResult", "optionalField"])) {
        await $("#loading, #upload, #result, .after-result, .optional-field").css({"z-index" : "0", "pointer-events" : "none"}).animate({opacity:0}, 500).promise();
      }
      $(".optional-field").fadeOut(500);
      $("#error").css({"z-index" : "1", "pointer-events" : "all"}).animate({opacity:1}, 500);
      globalVariable = {};
    },
    getState : function(){
      return $("#error").css("z-index") ? 1 : 0;
    }
  },
  result : {
    setMain : async function(){
      $(".optional-field").animate({height:"0px", padding:"0px", margin:"0px"}, 500).promise().then(() => $(".optional-field").css({display:"none", height:"", padding:"", margin:""}));
      if(panels.getAllState(["loading", "error", "upload", "optionalField"])) {
        await $("#loading, #error, #upload, .optional-field").css({"z-index" : "0", "pointer-events" : "none"}).animate({opacity:0}, 500);
      }
      $("#result, .after-result").css({"z-index" : "1", "pointer-events" : "all"}).animate({opacity:1}, 500);
      globalVariable = {};
    },
    getState : function(){
      return $("#result").css("z-index") == "1" ? 1 : 0;
    }
  },
}

//All documents and buttons clicks
document.addEventListener("keydown", function (e) {
  if (e.which === 123) {
    remote.getCurrentWindow().toggleDevTools();
  } else if (e.which === 116) {
    location.reload();
  }
});

$("#minimize-button").on('click', () => {
  remote.getCurrentWindow().minimize();
});
$("#close-button").on('click', () => {
  remote.app.quit();
});
$("#min-max-button").on('click', () => {
  const currentWindow = remote.getCurrentWindow();
  if(currentWindow.isMaximized()){
    currentWindow.unmaximize();
  }else{
    currentWindow.maximize();
  }
});

$("#save").on('click', () => {
  switch (getCurrentPanelAction()) {
    case "decryption":
    myUrlSaveAs($(".fade-slider-item.showing").text())
    break;
    case "analyze-blocks":
    myUrlSaveAs($(".fade-slider-item").text())
    break;

  }
});

$("#nextStep").on('click', () => {
  if(getCurrentPanelAction() == 'decrypt-with-key'){
    if($("#keyInput").val() !== "" && $("#keyInput").val() !== undefined && $("#keyInput").val() !== null && globalVariable["response"] !== undefined){
      globalVariable["response"].key = $("#keyInput").val();
      $("#keyInput").val("");
      uploadFile(getCurrentPanelAction(), globalVariable["response"])
    }else if($("#keyInput").val() == "" || $("#keyInput").val() == undefined || $("#keyInput").val() == null){
      $("#keyInput").parent().effect("shake");
    }else if(globalVariable["response"] == undefined){
      $("#upload").effect("shake");
    }
  }
});

$("#reload").on('click', switchPanel);

function reloadPanel(){
  switch (getCurrentPanelAction()) {
    case "decrypt-with-key":
      panels.upload.setMain(true);
      break;
    default:
      panels.upload.setMain();
  }
}

async function myUrlSaveAs(string){
  // app.getPath("desktop")       // User's Desktop folder
  // app.getPath("documents")     // User's "My Documents" folder
  // app.getPath("downloads")     // User's Downloads folder

  var toLocalPath = path.resolve(app.getPath("desktop"));

  var userChosenPath = await dialog.showSaveDialogSync({
    defaultPath: toLocalPath,
    filters: [
      { name : 'Fichier texte', extensions: ['txt'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ],
    nameFieldLabel : "decrypted"
  });

  if(userChosenPath){
    download(string, userChosenPath)
  }


}


function download (txt, dest) {
  var file = fs.writeFile(dest, txt, function(){
    ipcRenderer.send("openFolder", dest);
  });
};

//Switch panel
$(".panel-selection").on('click', function(){
  var oldPanelSelec = $(".panel-selection.active")[0];
  $(".panel-selection").removeClass("active");
  $(this).addClass("active");
  if(oldPanelSelec !== this) switchPanel();
});

function getCurrentPanelAction(){
  return $(".panel-selection.active").attr("switch-data");
}

async function switchPanel(){
  var newPanel = getCurrentPanelAction();

  switch (newPanel) {
    case "decryption":
    $("#title").html("Décryptage XOR pour six caractères")
    $("#descUpload").html("Glissez et déposez le fichier à décrypter ici.")
    $("#reload").html("Décrypter un autre fichier")
    $("#save").html("Sauvegarder .txt décrypté")
    break;

    case "analyze-blocks":
    $("#title").html("Analyse de blocks")
    $("#descUpload").html("Glissez et déposez le fichier à analyser ici.")
    $("#reload").html("Analyser un autre fichier")
    $("#save").html("Sauvegarder en .txt")
    break;

    case "decrypt-with-key":
    $("#title").html("Décryptage XOR avec clé")
    $("#descUpload").html("Glissez et déposez le fichier à décrypter ici.")
    $("#reload").html("Décrypter un autre fichier")
    $("#save").html("Sauvegarder .txt décrypté")
    break;
  }

  reloadPanel();

}

(function () {
  var holder = document.getElementById('upload');

  holder.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if(!holder.classList.contains("dragged-over")){
      holder.classList.add("dragged-over");
    }

    return false;
  });

  holder.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if(holder.classList.contains("dragged-over")){
      holder.classList.remove("dragged-over");
    }

    return false;
  });

  holder.addEventListener("dragend", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if(holder.classList.contains("dragged-over")){
      holder.classList.remove("dragged-over");
    }

    return false;
  });

  holder.addEventListener("click", async (e) => {

    var toLocalPath = path.resolve(app.getPath("desktop"));

    var userChosenPath = await dialog.showOpenDialogSync({
      defaultPath: toLocalPath,
      filters: [
        { name : 'Fichier texte', extensions: ['txt'] },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    });

    if(userChosenPath){
      panelAction(userChosenPath, true);
    }
  });

  holder.addEventListener("drop", function(e){
    panelAction(e);
  });
})();

function panelAction(e, isMethodClick){

  if(!isMethodClick){
    e.preventDefault();
    e.stopPropagation();
  }

  if($("#upload").is(".dragged-over")){
    $("#upload").removeClass("dragged-over");
  }

  var response = {};
  var action = getCurrentPanelAction();

  // Check for errors
  if(isMethodClick){
    if(e.length > 1){
      response = {type : "error", text : "Ne déposez qu'un seul fichier à la fois !", fallback : "reload"};
    }else
    if(e[0].substring(e[0].lastIndexOf("\\") + 1).indexOf('.') == -1 || e[0].substring(e[0].lastIndexOf(".")+1) !== "txt"){
      response = {type : "error", text : "Le fichier doit être un fichier .txt !", fallback : "reload"};
    }else{
      response = {type : "loading", text : "", file : e[0]};
    }
  }else{
    if(e.dataTransfer.files.length > 1){
      response = {type : "error", text : "Ne déposez qu'un seul fichier à la fois !", fallback : "reload"};
    }else
    if(e.dataTransfer.files[0].name.indexOf('.') == -1 || e.dataTransfer.files[0].name.substring(e.dataTransfer.files[0].name.lastIndexOf(".")+1) !== "txt"){
      response = {type : "error", text : "Le fichier doit être un fichier .txt !", fallback : "reload"};
    }else{
      response = {type : "loading", text : "", file : e.dataTransfer.files[0].path};
    }
  }

  switch (action) {
    case "decrypt-with-key":
      globalVariable["response"] = response;
      $("#descUpload").html(response.file);
      $("#upload svg").is(".rotate") ? $("#upload svg").removeClass("rotate") : $("#upload svg").addClass("rotate")
      break;
    default:
      uploadFile(action, response);
  }
}

function showFile(){
  $("#descUpload").html(response.file)
}

async function uploadFile(action, response) {

  switch (response.type) {
    case 'error':
    await panels.error.setMain();
    await $("#error").effect("shake").promise();

    if(response.fallback == "reload"){
      setTimeout(async function(){
        await panels.upload.setMain();
      }, 2000);
    }
    return;
    break;

    case 'loading':
    switch (action) {
      case "analyze-blocks":
      response.text = "Le fichier est en train d'être analysé...";
      ipcRenderer.send(action, response.file);
      break;
      case "decryption":
      response.text = "Le fichier est en train d'être décrypté...";
      ipcRenderer.send(action, response.file);
      break
      case "decrypt-with-key":
      response.text = "Le fichier est en train d'être décrypté...";
      console.log({file: response.file, key: response.key})
      ipcRenderer.send(action, {file: response.file, key: response.key});
      break
    }
    $("#loading span").html(response.text)
    panels.loading.setMain();
    break;
  }

  return false;
}

ipcRenderer.on('progressPercent', async function(event, arg){
  $(".progressbar").css("width", arg + "%");
});

ipcRenderer.on('results', async function(event, arg){
  var solutions = arg.solutions;

  //Deleting previous results
  $("#result .fade-slider").html("");

  //Adding results
  solutions.forEach((item, index) => {
    //Creating slider item element
    var $sliderItem = $("<div class='fade-slider-item'>");
    if(index == 0) $sliderItem.addClass("showing");

    //Giving html
    var html = "";

    //Switch for type of response
    switch (arg.action) {
      case "decryption":
      html = "<h1>Résultat " + (index+1) + ", clé \"" + item.key + "\" :\n\n</h1><br>";
      html += "<span>" + item.decrypted.replace(/\n/g, "\n<br>") + "</span>";
      break;
      case "decrypt-with-key":
      html = "<h1>Résultat avec clé \"" + item.key + "\" :\n\n</h1><br>";
      html += "<span>" + item.decrypted.replace(/\n/g, "\n<br>") + "</span>";
      break;
      case "analyze-blocks":
      html = "<h1>Résultat du block " + (index+1) + " :\n\n</h1><br>";
      html += "<span>Les lettres \"" + item[0].letter + "\" et \"" + item[1].letter +
      "\" ont retourné les plus grandes probabilités de décryptage basé sur leur score respectif.\n</span><br>";
      html += "<br><span>Score de \"" + item[0].letter + "\" : " + Math.floor(item[0].score) + "\n</span>";
      html += "<br><span>Score de \"" + item[1].letter + "\" : " + Math.floor(item[1].score) + "\n</span>";
      break;


    }

    //Appending item
    $sliderItem.html(html);
    $("#result .fade-slider").append($sliderItem);
  });

  regenerateSlides();

  await panels.result.setMain();
})

// Function for Fade-slider

let slides,
curSlide = 0,
countValCur,
countValSum,
prevBtn,
nextBtn;

function regenerateSlides(){
  slides = document.querySelectorAll('.fade-slider-item');
  countValCur.innerHTML = ''+1+'';
  countValSum.innerHTML = '/'+slides.length+'';
}

countValCur = document.querySelector('.fade-sl-counter .current');
countValSum = document.querySelector('.fade-sl-counter .sum');
prevBtn = document.querySelector('.fade-arrow-prev');
nextBtn = document.querySelector('.fade-arrow-next');

regenerateSlides();

prevBtn.onclick = function() {
  prevSlide();
};

nextBtn.onclick = function() {
  nextSlide();
};

function nextSlide() {
  changeSlide(curSlide+1);
};

function prevSlide() {
  changeSlide(curSlide-1);
};

function changeSlide(n) {
  slides[curSlide].className = 'fade-slider-item';
  curSlide = (n + slides.length) %slides.length;
  slides[curSlide].className = 'fade-slider-item showing';

  countValCur.innerHTML = ''+(curSlide + 1)+'';
  countValSum.innerHTML = '/'+slides.length+'';
};

// End Fade-slider
