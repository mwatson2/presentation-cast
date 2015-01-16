# Presentation API Demo: Slideshow

Presents a list of photo URLs in sequence.  Playback is controlled by the
following set of messages from controller to player:

```
// Initialize with a list of photos.
{cmd: 'init', params: [[<list of urls]]}

// Start playback with 5 seconds between photos.
{cmd: 'play'}

// Pause playback.
{cmd: 'pause'}

// Go to the next photo (and pause playback)
{cmd: 'next'}

// Go to the previous photo  (and pause playback)
{cmd: 'previous'}
```

Each time the current photo changes a status message is sent back to the
controller:

```
{
 currentIndex: <index of current photo>,
 numPhotos: <total number of photos>,
 playing: <true if playback is active, false otherwise>
}
```
## TODOs

1. Add photos on-the-fly to an existing presentation.
2. Send list of photo thumbnails to controllers so they can offer a viewer/picker.
3. Add interesting metadata to photos (tags, authorship, location, caption...)



