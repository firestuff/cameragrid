/*
Copyright 2014 Ian Gulliver

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var cameraGrid = {};

/**
 * @name getUrl
 * @function
 * @param {String} sourceUrl Base URL of the camera
 * @param {number} width Valid resolution width in pixels
 * @param {number} height Valid resolution height in pixels
 * @return String
 */

/**
 * @constructor
 * @export
 * @param {Node} container DOM container object to hold UI
 * @param {Array.<String>} sourceUrls Array of Axis camera URLs
 * @param {Array.<Array.<number>>=} resolutions Array of [width,height] resolution tuples
 * @param {getUrl=} getUrl Callback to generate URL for a given camera
 */
cameraGrid.CameraGrid = function(container, sourceUrls, resolutions, getUrl) {
  this.container_ = container;
  this.sourceUrls_ = sourceUrls;
  this.resolutions_ = resolutions || this.defaultResolutions_;
  this.getUrl_ = getUrl || this.defaultGetUrl_;

  this.tileScaleWidth_ = this.resolutions_[0][0];
  this.tileScaleHeight_ = this.resolutions_[0][1];

  this.gridWidthCells_ = 0;
  this.gridHeightCells_ = 0;

  this.imgWidthPx_ = 0;
  this.imgHeightPx_ = 0;
  this.constraint_ = null;

  this.containerImgWidthPx_ = 0;
  this.ctonainerImgHeightPx_ = 0;
  this.containerConstraint_ = null;

  this.selected_ = null;
  this.scanning_ = false;

  this.buildCells_();
  this.buildStylesheet_();

  this.container_.tabIndex = 0;
  this.container_.focus();
  this.container_.addEventListener('keypress', this.onKeyPress_.bind(this), false);
  this.container_.addEventListener('keydown', this.onKeyDown_.bind(this), false);

  window.addEventListener('resize', this.rebuildIfNeeded_.bind(this), false);
  this.rebuildIfNeeded_();

  window.setInterval(this.onScanTimer_.bind(this), 3000);
};

// Resolution list must be sorted ascending.
// All resolutions must be the same aspect ratio.
cameraGrid.CameraGrid.prototype.defaultResolutions_ = [
  [ 160, 120 ],
  [ 240, 180 ],
  [ 320, 240 ],
  [ 480, 360 ],
  [ 640, 480 ],
  [ 800, 600 ],
  [ 1024, 768 ],
  [ 1280, 960 ],
];

cameraGrid.CameraGrid.prototype.defaultGetUrl_ = function(sourceUrl, width, height) {
  return sourceUrl + 'mjpg/video.mjpg?resolution=' + width + 'x' + height;
};

cameraGrid.CameraGrid.prototype.disableScanning_ = function() {
  if (this.scanning_) {
    this.scanning_ = false;
    // Images might all be higher res than needed, so we refresh.
    this.buildImages_();
  }
};

cameraGrid.CameraGrid.prototype.setSelectedNoScan_ = function(index) {
  this.setSelected_(index);
  this.disableScanning_();
};

cameraGrid.CameraGrid.prototype.setSelected_ = function(index) {
  var old_index = null;

  if (this.selected_ == index) {
    this.removeCSSClass_(this.cells_[this.selected_], 'cameraGridFullScreen');
    old_index = this.selected_;
    this.selected_ = null;
  } else {
    if (this.selected_ != null) {
      this.removeCSSClass_(this.cells_[this.selected_], 'cameraGridFullScreen');
      old_index = this.selected_;
    }
    this.addCSSClass_(this.cells_[index], 'cameraGridFullScreen');
    this.selected_ = index;
  }

  if (this.containerImgWidthPx_ != this.imgWidthPx_ ||
      this.containerImgHeightPx_ != this.imgHeightPx_) {
    // Image stream should change when toggling full screen.
    if (old_index != null) {
      this.buildImage_(old_index);
    }
    if (this.selected_ != null) {
      this.buildImage_(this.selected_);
    }
  }
};

cameraGrid.CameraGrid.prototype.buildCells_ = function() {
  this.cells_ = [];
  for (var i = 0; i < this.sourceUrls_.length; i++) {
    var cell = document.createElement('cameraGridCell');
    this.cells_.push(cell);
  }
};

cameraGrid.CameraGrid.prototype.addCSSClass_ = function(node, className) {
  var classes = node.className.split(' ').filter(function(className) { return className; });
  if (classes.indexOf(className) != -1) {
    // Already has class.
    return;
  }
  classes.push(className);
  node.className = classes.join(' ');
}

cameraGrid.CameraGrid.prototype.removeCSSClass_ = function(node, className) {
  var classes = node.className.split(' ').filter(function(className) { return className; });
  var i = classes.indexOf(className);
  if (i == -1) {
    // Already doesn't have class.
    return;
  }
  delete classes[i];
  node.className = classes.join(' ');
}

cameraGrid.CameraGrid.prototype.buildStylesheet_ = function() {
  var style = document.createElement('style');
  document.head.appendChild(style);

  style.sheet.insertRule('cameraGridRow {}', 0);
  this.rowHeightRule_ = style.sheet.cssRules[0];
  style.sheet.insertRule('cameraGridCell {}', 0);
  this.cellWidthRule_ = style.sheet.cssRules[0];
  style.sheet.insertRule('cameraGridImgContainer img {}', 0);
  this.imageScaleRule_ = style.sheet.cssRules[0];
  style.sheet.insertRule('cameraGridCell.cameraGridFullScreen cameraGridImgContainer img {}', 0);
  this.containerImageScaleRule_ = style.sheet.cssRules[0];

  style.sheet.insertRule('cameraGridRow { display: block; width: 100% }', 0);
  style.sheet.insertRule('cameraGridCell { display: inline-block; height: 100%; position: relative }', 0);
  style.sheet.insertRule('cameraGridImgContainer { position: absolute; top: 0; left: 0; bottom: 0; right: 0; text-align: center }', 0);
  style.sheet.insertRule('cameraGridImgContainer img { max-height: 100%; max-width: 100% }', 0);
  style.sheet.insertRule('.cameraGridContainer { font-size: 0; text-align: center; -webkit-user-select: none; -moz-user-select: none; }', 0);
  style.sheet.insertRule('cameraGridCell.cameraGridFullScreen { position: static }', 0);
  style.sheet.insertRule('cameraGridCell.cameraGridFullScreen cameraGridImgContainer { z-index: 1 }', 0);

  this.addCSSClass_(this.container_, 'cameraGridContainer');
};

cameraGrid.CameraGrid.prototype.calculateGrid_ = function() {
  var containerWidth = this.container_.offsetWidth;
  var containerHeight = this.container_.offsetHeight;
  var numTiles = this.sourceUrls_.length;

  var scaleFactor = ((containerHeight / this.tileScaleHeight_)
                     / (containerWidth / this.tileScaleWidth_));

  var gridHeight = Math.sqrt(scaleFactor * numTiles);
  var gridWidth = Math.sqrt(numTiles / scaleFactor);

  var gridOptions = [
    [ Math.ceil(gridWidth), Math.floor(gridHeight) ],
    [ Math.floor(gridWidth), Math.ceil(gridHeight) ],
    [ Math.ceil(gridWidth), Math.ceil(gridHeight) ],
  ];

  // Check all possible options.
  // We are optimizing for several dimensions (decreasing priority):
  // 1) Be able to fit all the tiles.
  // 2) Maximum scale for an image in each cell.
  // 3) Minimize number of cells.
  var minCells = Number.MAX_VALUE;
  var maxScale = 0.0;
  var chosenHeight, chosenWidth, chosenConstraint;
  for (var i = 0; i < gridOptions.length; i++) {
    var gridOption = gridOptions[i];
    var numCells = gridOption[0] * gridOption[1];
    if (numCells < numTiles) {
      // Can't fit all the tiles in (we've rounded down too far).
      continue;
    }
    var widthScale = (containerWidth / gridOption[0]) / this.tileScaleWidth_;
    var heightScale = (containerHeight / gridOption[1]) / this.tileScaleHeight_;
    var scale, constraint;
    if (widthScale < heightScale) {
      scale = widthScale;
      constraint = 'width';
    } else {
      scale = heightScale;
      constraint = 'height';
    }
    if (scale < maxScale) {
      // This would make cells smaller than another viable solution.
      continue;
    }
    if (scale == maxScale && numCells > minCells) {
      // Same cell size as another viable solution, but ours has more cells.
      continue;
    }
    chosenWidth = gridOption[0];
    chosenHeight = gridOption[1];
    chosenConstraint = constraint;
    minCells = numCells;
    maxScale = scale;
  }

  return {
    gridWidthCells: chosenWidth,
    gridHeightCells: chosenHeight,
    constraint: chosenConstraint,
    containerConstraint: scaleFactor > 1 ? 'width' : 'height',
    cellWidthPx: this.tileScaleWidth_ * maxScale,
    cellHeightPx: this.tileScaleHeight_ * maxScale,
  };
};

cameraGrid.CameraGrid.prototype.findMinimumResolution_ = function(tileWidth, tileHeight) {
  for (var i = 0; i < this.resolutions_.length; i++) {
    var resolution = this.resolutions_[i];
    if (i + 1 < this.resolutions_.length &&
        (resolution[0] < tileWidth && resolution[1] < tileHeight)) {
      continue;
    }
    return {
      imgWidthPx: resolution[0],
      imgHeightPx: resolution[1],
    };
  }
};

cameraGrid.CameraGrid.prototype.deletePreviousSiblings_ = function(element) {
  while (element.previousSibling) {
    element.parentNode.removeChild(element.previousSibling);
  }
};

cameraGrid.CameraGrid.prototype.buildImage_ = function(index) {
  var sourceUrl = this.sourceUrls_[index];
  var imgUrl = (
      (this.scanning_ || index == this.selected_) ?
      this.getUrl_(sourceUrl, this.containerImgWidthPx_, this.containerImgHeightPx_) :
      this.getUrl_(sourceUrl, this.imgWidthPx_, this.imgHeightPx_));
  var cell = this.cells_[index];

  // cell > imgContainer(s) > img
  // Last imgContainer will eventually win.
  if (cell.lastChild && cell.lastChild.firstChild.src == imgUrl) {
    // We'd be re-adding the same image; skip.
    return;
  }

  var img = document.createElement('img');
  img.src = imgUrl;
  var imgContainer = document.createElement('cameraGridImgContainer');
  imgContainer.addEventListener('click', this.setSelected_.bind(this, index), false);
  img.addEventListener('load', this.deletePreviousSiblings_.bind(this, imgContainer), false);
  imgContainer.appendChild(img);
  cell.appendChild(imgContainer);
};

cameraGrid.CameraGrid.prototype.buildImages_ = function() {
  for (var i = 0; i < this.sourceUrls_.length; i++) {
    this.buildImage_(i);
  }
};

cameraGrid.CameraGrid.prototype.buildGrid_ = function() {
  this.container_.innerHTML = '';

  this.rowHeightRule_.style.height = 100 / this.gridHeightCells_ + '%';
  this.cellWidthRule_.style.width = 100 / this.gridWidthCells_ + '%';

  var i = 0;
  for (var y = 0; y < this.gridHeightCells_; y++) {
    var row = document.createElement('cameraGridRow');
    for (var x = 0; x < this.gridWidthCells_; x++) {
      if (i < this.cells_.length) {
        var cell = this.cells_[i];
        row.appendChild(cell);
        i++;
      }
    }
    this.container_.appendChild(row);
  }
};

cameraGrid.CameraGrid.prototype.setUpscaleRule_ = function(constraint, rule) {
  if (constraint == 'height') {
    rule.style.minWidth = 0;
    rule.style.minHeight = '100%';
  } else {
    rule.style.minWidth = '100%';
    rule.style.minHeight = 0;
  }
};

cameraGrid.CameraGrid.prototype.rebuildIfNeeded_ = function() {
  var grid = this.calculateGrid_();
  var resolution = this.findMinimumResolution_(grid.cellWidthPx, grid.cellHeightPx);
  var containerResolution = this.findMinimumResolution_(this.container_.offsetWidth, this.container_.offsetHeight);

  if (grid.constraint != this.constraint_) {
    this.constraint_ = grid.constraint;
    this.setUpscaleRule_(this.constraint_, this.imageScaleRule_);
  }

  if (grid.containerConstraint != this.containerConstraint_) {
    this.containerConstraint_ = grid.containerConstraint;
    this.setUpscaleRule_(this.containerConstraint_, this.containerImageScaleRule_);
  }

  if (resolution.imgWidthPx != this.imgWidthPx_ ||
      resolution.imgHeightPx != this.imgHeightPx_) {
    // Need to recache images.
    this.imgWidthPx_ = resolution.imgWidthPx;
    this.imgHeightPx_ = resolution.imgHeightPx;
    this.buildImages_();
  }

  if (containerResolution.imgWidthPx != this.containerImgWidthPx_ ||
      containerResolution.imgHeightPx != this.containerImgHeightPx_) {
    this.containerImgWidthPx_ = containerResolution.imgWidthPx;
    this.containerImgHeightPx_ = containerResolution.imgHeightPx;
    if (this.selected_ != null) {
      this.buildImage_(this.selected_);
    }
  }

  if (grid.gridWidthCells != this.gridWidthCells_ ||
      grid.gridHeightCells != this.gridHeightCells_) {
    this.gridWidthCells_ = grid.gridWidthCells;
    this.gridHeightCells_ = grid.gridHeightCells;
    this.buildGrid_();
  }
};

cameraGrid.CameraGrid.prototype.onKeyPress_ = function(e) {
  var character = String.fromCharCode(e.charCode);
  switch (character) {
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
    case '0':
      var index = e.charCode - '1'.charCodeAt(0);
      if (index == -1) {
        index = 10;
      }
      if (index < this.cells_.length) {
        this.setSelectedNoScan_(index);
      }
      break;
    case 's':
      if (this.scanning_ && this.selected_ != null) {
        // Toggle off
        this.setSelectedNoScan_(this.selected_);
        return;
      }
      this.scanning_ = true;
      if (this.selected_ == null) {
        this.setSelected_(0);
      }
      break;
    case ' ':
      this.scanning_ = !this.scanning_;
      break;
  }
};

cameraGrid.CameraGrid.prototype.scanLeft_ = function() {
  this.setSelected_(this.selected_ > 0 ? this.selected_ - 1 : this.cells_.length - 1);
};

cameraGrid.CameraGrid.prototype.scanRight_ = function() {
  this.setSelected_((this.selected_ + 1) % this.cells_.length);
};

cameraGrid.CameraGrid.prototype.onKeyDown_ = function(e) {
  switch (e.keyCode) {
    case 27: // Esc
      if (this.selected_ != null) {
        // Toggle selected feed off.
        this.setSelectedNoScan_(this.selected_);
      }
      break;
    case 37: // Left arrow
      if (this.selected_ != null) {
        this.scanLeft_();
        this.disableScanning_();
      }
      break;
    case 39: // Right arrow
      if (this.selected_ != null) {
        this.scanRight_();
        this.disableScanning_();
      }
      break;
  }
};

cameraGrid.CameraGrid.prototype.onScanTimer_ = function() {
  if (!this.scanning_ || this.selected_ == null) {
    return;
  }
  this.scanRight_();
};
