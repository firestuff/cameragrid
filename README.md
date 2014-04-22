cameragrid
==========

Axis multiple camera feed display.

Feature overview:
* Multiple cameras feeds displayed in a grid
* Uses camera MJPG feeds
* Automatic video feed sizing to minimize bandwidth
* Automatic grid layout to maximize visible space
* Preserves camera feed aspect ratio
* Responsive to browser window resizing
* Supports full-screening of individual camera feeds
* Supports timed scanning through all camera feeds

You can use this script directly from github/rawgithub. Create a URL like:

https://rawgit.com/flamingcowtv/cameragrid/master/cameragrid.html#http://127.0.0.1/,http://127.0.0.5:2005/

Substitute your own Axis camera URLs for the URLs after the #, and separate them with commas.

There are some keyboard shortcuts:
* 1-9:     select a camera
* (esc):   back to grid
* s:       scan through cameras
* (space): pause scan
