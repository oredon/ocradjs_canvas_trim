"use strict";

var isTouch = "ontouchstart" in window;
var isDrag    = false;
var dragstart = (isTouch ? "touchstart" : "mousedown");
var dragmove  = (isTouch ? "touchmove" : "mousemove");
var dragend   = (isTouch ? "touchend" : "mouseup");
var $canvas;
var context;
var $originImg;
var $editImgWrp;
var $editImg;
var canvasDimension = {width: 600, height: 600};
var originImgDimension = {width: 0, height: 0};
var canvasPerOriginScale = 1;
var canvasDragState = {};
var memoryFile;
var $execOcr;
var $clippedImg;
var $result;
var $changeMode;
var $loading;
var isClipMode = false;
var canvasClipState = {};
var $placeholder;

// Init ---------------------------------------------------
/**
 * ID指定によるelement取得 getElementByIdショートコード
 * @param  {String} _id 取得したい要素のID文字列
 * @return {Object}     HTML要素
 */
var geId = (_id) => {
  return document.getElementById(_id);
}

/**
 * jQueryに依存しないanimate関数
 * @param  {Object}  el         アニメーションさせたいDOM要素
 * @param  {Object}  prop       変化させたいプロパティ名ないしstyle名
 * @param  {Object}  suf        pxや%など、単位suffix
 * @param  {Number}  from       開始値
 * @param  {Number}  to         終了値
 * @param  {Number}  duration   イージング時間msec.
 * @param  {Boolean} isProperty 変化させたい対象がプロパティならtrue、スタイルならfalse
 */
var animate = (el, prop, suf, from, to, duration, isProperty) => {
  var startTime = new Date().getTime();
  var intervalId = setInterval(function() {
    var step = Math.min(1, (new Date().getTime() - startTime) / duration);
    var val  = (from + step * (to - from)) + suf;
    if(isProperty){
      el[prop] = val;
    }else{
      el.style[prop] = val;
    }
    if(step == 1){
      clearInterval(intervalId);
      intervalId = null;
    }
  },16);
  el.style[prop] = from + suf;
}

/**
 * windowのX軸スクロール量の取得
 * @return {Number} スクロール量px
 */
var getWindowScrollLeft = () => {
  return (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
}
/**
 * windowのY軸スクロール量の取得
 * @return {Number} スクロール量px
 */
var getWindowScrollTop = () => {
  return (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
}

/**
 * Load直後実行関数
 */
var onLoaded = () => {
  // filedrop
  $editImgWrp = geId("editImgWrp");
  $editImg    = geId("editImg");
  addFileDropEvent();

  // ocr
  $execOcr     = geId("execOcr");
  $clippedImg  = geId("clippedImg");
  $changeMode  = geId("changeMode");
  $loading     = geId("loading");
  $placeholder = geId("placeholder");
  addOcrEvent();
}

/**
 * OCRイベントの割り当て
 */
var addOcrEvent = () => {
  $changeMode.addEventListener("click", function(){
    isClipMode = !isClipMode;
    isClipMode ? $changeMode.innerText = "位置変更モードへ戻す" : $changeMode.innerText = "トリミングモードにする";
  }, false);
  $execOcr.addEventListener("click", execOcr, false);
}

/**
 * OCR実行処理
 */
var execOcr = () => {
  $loading.className = "";
  var data = $canvas.toDataURL();

  $clippedImg.innerHTML = null;
  $clippedImg.innerHTML = '<img src="'+data+'" alt="" />';

  var $img = $clippedImg.querySelector("img");
  var result = "";
  setTimeout(function(){
    result = OCRAD($img);
    geId("result").value = result;
    console.log(result);
    setTimeout(function(){
      $loading.className = "hideDis";
      var target = geId("done");
      animate(document.body, "scrollTop", "", getWindowScrollTop(), target.offsetTop, 300, true);
    },16*30);
  },0);
}

// canvas drop ---------------------------------------------------
/**
 * ファイルドロップイベント割り当て
 */
var addFileDropEvent = () => {
  var $fileInputWrp = geId("fileInputWrp");
  $fileInputWrp.addEventListener("dragover", fileDragOver, false);
  $fileInputWrp.addEventListener("dragleave", fileDragOver, false);
  $fileInputWrp.addEventListener("drop", fileDrop, false);
}

/**
 * ファイルドラッグ中のイベント
 * @param  {Event} e イベントオブジェクト
 */
var fileDragOver = (e) => {
  e.stopPropagation();
	e.preventDefault();
	e.target.className = (e.type == "dragover" ? "dragging" : "");
}

/**
 * ファイルをドロップしたときのイベント
 * @param  {Event} e イベントオブジェクト
 */
var fileDrop = (e) => {
  e.stopPropagation();
  e.preventDefault();
  e.target.className = "";

  var files = e.target.files || e.dataTransfer.files;
  //単一ファイルだけを許す
  if(files.length == 1){
    // file accept
    readFile(files);
  }else{
    // file error
    alert("ファイルは１つずつ、pngかjpgでお願いします。")
  }
}

/**
 * ドロップされたファイルをDataURLにして読み込む
 * @param  {File} files ファイルオブジェクト
 */
var readFile = (files) => {
  //reader生成
  var reader = new FileReader();
  memoryFile = files[0];
  //DataURLをファイル読み込み
  reader.readAsDataURL(files[0]);

  //ファイル読み込み完了
  reader.onload = function(){
    showImg(reader);
  }
}

var showImg = (reader) => {
  geId("imgContain").className ="";

  if($originImg !== undefined){
    $editImg.innerHTML = null;
  }
  //DataURLからimgを生成、出力
  var $tmp = document.createElement("img");
  $tmp.setAttribute("class", "originImg");
  $tmp.setAttribute("src", reader.result);
  $editImg.appendChild($tmp);
  $originImg = $editImg.querySelector(".originImg");

  //オリジナル画像の縦横サイズを取得
  originImgDimension.width = $originImg.width;
  originImgDimension.height = $originImg.height;
  $originImg.style.display = "none";

  //canvasを生成、出力
  $tmp = document.createElement("canvas");
  $editImg.appendChild($tmp);
  $canvas = $editImg.querySelector("canvas");

  //canvasのサイズ調整
  $canvas.setAttribute("width", canvasDimension.width);
  $canvas.setAttribute("height", canvasDimension.height);

  //canvasのコンテクストを取得
  context = $canvas.getContext('2d');

  //オリジナル画像をcanvasにフィットさせる際の拡大縮小比率の取得
  canvasPerOriginScale = getImgScale();

  //コンテクストのスケーリング、画像出力
  drawCanvas(0,0);

  canvasDragState.startCanvasX = 0;
  canvasDragState.startCanvasY = 0;

  setCanvasDragEvent();
  setCanvasZoomEvent();
}

/**
 * canvasの移動ドラッグイベント割り当て
 */
var setCanvasDragEvent = () => {
  removeCanvasDragEvent();
  $canvas.addEventListener(dragstart, canvasDragStart, false);
  $canvas.addEventListener(dragmove, canvasDragMove, false);
  $canvas.addEventListener(dragend, canvasDragEnd, false);
}

/**
 * canvasの移動ドラッグイベントの解除
 */
var removeCanvasDragEvent = () => {
  $canvas.removeEventListener(dragstart, canvasDragStart, false);
  $canvas.removeEventListener(dragmove, canvasDragMove, false);
  $canvas.removeEventListener(dragend, canvasDragEnd, false);
}
/**
 * canvasドラッグスタート
 * @param  {Event} e イベントオブジェクト
 */
var canvasDragStart = (e) => {
  if( !isClipMode ){
    canvasDragState.isDrag = true;
    canvasDragState.startx = (isTouch ? event.changedTouches[0].clientX : e.clientX);
    canvasDragState.starty = (isTouch ? event.changedTouches[0].clientY : e.clientY);
  }else{
    canvasClipState.isDrag = true;
    canvasClipState.startx = (isTouch ? event.changedTouches[0].clientX : e.clientX);
    canvasClipState.starty = (isTouch ? event.changedTouches[0].clientY : e.clientY);
    $placeholder.className = "";
  }
}
/**
 * canvasドラッグムーブ
 * @param  {Event} e イベントオブジェクト
 */
var canvasDragMove = (e) => {
  if( !isClipMode ){
    if( canvasDragState.isDrag ){
      e.preventDefault();
      //スワイプ位置の取得
      var clientx, clienty;
      clientx = (isTouch ? event.changedTouches[0].clientX : e.clientX);
      clienty = (isTouch ? event.changedTouches[0].clientY : e.clientY);

      //画像の現在posに スワイプ位置と開始位置の差を加えた値をdiffとする
      var diffx, diffy;
      diffx = canvasDragState.startCanvasX + ( clientx - canvasDragState.startx );
      diffy = canvasDragState.startCanvasY + ( clienty - canvasDragState.starty );

      //いったんクリア
      clearCanvas();
      //描画
      drawCanvas(diffx, diffy);

      //画像の現在pos用外部記憶更新（dragendのタイミングで画像位置としてcommitする）
      canvasDragState.canvasPosX = diffx;
      canvasDragState.canvasPosY = diffy;
    }
  }else{
    if( canvasClipState.isDrag ){
      e.preventDefault();

      //スワイプ位置の取得
      var clientx, clienty;
      clientx = (isTouch ? event.changedTouches[0].clientX : e.clientX);
      clienty = (isTouch ? event.changedTouches[0].clientY : e.clientY);

      var dim = getRectDimension(canvasClipState.startx, canvasClipState.starty, clientx, clienty);

      $placeholder.style.top = dim.minY + "px";
      $placeholder.style.left = dim.minX + "px";
      $placeholder.style.width = (dim.maxX - dim.minX) + "px";
      $placeholder.style.height = (dim.maxY - dim.minY) + "px";
    }
  }
}
/**
 * canvasドラッグエンド
 * @param  {Event} e イベントオブジェクト
 */
var canvasDragEnd = (e) => {
  if( !isClipMode ){
    canvasDragState.isDrag = false;
    canvasDragState.startCanvasX = canvasDragState.canvasPosX;
    canvasDragState.startCanvasY = canvasDragState.canvasPosY;
  }else{
    canvasClipState.isDrag = false;
    canvasClipState.endx = (isTouch ? event.changedTouches[0].clientX : e.clientX);
    canvasClipState.endy = (isTouch ? event.changedTouches[0].clientY : e.clientY);

    var dim = getRectDimension(canvasClipState.startx, canvasClipState.starty, canvasClipState.endx, canvasClipState.endy);

    clearCanvas();

    context.beginPath();
    context.rect(0, 0, canvasDimension.width + (canvasDimension.width / canvasPerOriginScale), canvasDimension.height + (canvasDimension.height / canvasPerOriginScale));
    context.fillStyle = "rgb(255,255,255)";
    context.fill();

    context.beginPath();
    context.rect(dim.minX, dim.minY, (dim.maxX - dim.minX), (dim.maxY - dim.minY));
    context.clip();

    drawCanvas(canvasDragState.startCanvasX, canvasDragState.startCanvasY);

    $placeholder.className = "hideDis";
  }
}

var getRectDimension = (startx, starty, endx, endy) => {
  var obj = {};
  obj.minX = Math.min(startx,endx);
  obj.minY = Math.min(starty,endy);
  obj.maxX = Math.max(startx,endx);
  obj.maxY = Math.max(starty,endy);


  var rect = $canvas.getBoundingClientRect() ;
  var positionX = rect.left;	// 要素のX座標
  var positionY = rect.top;	// 要素のY座標

  obj.minX -= positionX;
  obj.maxX -= positionX;
  obj.minY -= positionY;
  obj.maxY -= positionY;

  return obj;
}

/**
 * canvasのドロー
 */
var drawCanvas = (x,y) => {
  context.drawImage($originImg, x, y, originImgDimension.width * canvasPerOriginScale, originImgDimension.height * canvasPerOriginScale);
}

/**
 * canvasのドローエリアをクリア
 */
var clearCanvas = () => {
  context.clearRect(0, 0, canvasDimension.width + (canvasDimension.width / canvasPerOriginScale), canvasDimension.height + (canvasDimension.height / canvasPerOriginScale));
}

/**
 * canvasの拡大縮小
 */
var setCanvasZoomEvent = () => {
  geId("imgScaleBig").addEventListener("click", function(){
    //いったんクリア
    clearCanvas();

    canvasPerOriginScale *= 1.5;
    drawCanvas(canvasDragState.startCanvasX, canvasDragState.startCanvasY);
  }, false);

  geId("imgScaleSmall").addEventListener("click", function(){
    //いったんクリア
    clearCanvas();

    canvasPerOriginScale *= 0.5;
    drawCanvas(canvasDragState.startCanvasX, canvasDragState.startCanvasY);
  }, false);
}

/**
 * 画像をcanvasにフィットさせる縮小率の計算
 * @return {Float} 拡大縮小率
 */
var getImgScale = () => {
  if( originImgDimension.width > originImgDimension.height ){
    //横長　縦を基準にscaling
    var scale = canvasDimension.height / originImgDimension.height;
  }else{
    //縦長
    var scale = canvasDimension.width / originImgDimension.width;
  }
  return scale;
}

// onReady ---------------------------------------------------
(() => {
  document.addEventListener('DOMContentLoaded', onLoaded, false);
})();
