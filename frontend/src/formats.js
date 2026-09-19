import TimelineCover from './covers/TimelineCover'
import BubbleMapCover from './covers/BubbleMapCover'
import GalleryCover from './covers/GalleryCover'

// `backendName` is the id GET /api/formats reports for this renderer (the
// skills/render-<name>/ folder name with the "render-" prefix stripped) —
// FormatPicker matches on this, not on `id`, since a couple of these predate
// the auto-discovery endpoint and use a different `id` elsewhere in the app
// (generation endpoint routing, past-editions labels).
export const formats = [
  {
    id: 'timeline',
    backendName: 'timeline',
    label: 'Timeline',
    description: 'An interactive vertical timeline with expandable detail',
    active: true,
    contentType: 'text',
    Cover: TimelineCover,
    previewUrl: '/demos/timeline.html',
  },
  {
    id: 'gallery',
    backendName: 'gallery',
    label: 'Gallery',
    description: 'An interactive masonry grid of expandable photo cards',
    active: true,
    contentType: 'image',
    Cover: GalleryCover,
    previewUrl: '/demos/gallery.html',
  },
  {
    id: 'bubble-map',
    backendName: 'bubble',
    label: 'Bubble map',
    description: 'An interactive, clustered map for non-linear exploration',
    active: true,
    contentType: 'both',
    Cover: BubbleMapCover,
    previewUrl: '/demos/bubble-map.html',
  },
]
