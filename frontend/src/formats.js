import TimelineCover from './covers/TimelineCover'
import BubbleMapCover from './covers/BubbleMapCover'
import GalleryCover from './covers/GalleryCover'

export const formats = [
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'An interactive vertical timeline with expandable detail',
    active: true,
    contentType: 'text',
    Cover: TimelineCover,
  },
  {
    id: 'gallery',
    label: 'Gallery',
    description: 'An interactive masonry grid of expandable photo cards',
    active: true,
    contentType: 'image',
    Cover: GalleryCover,
  },
  {
    id: 'bubble-map',
    label: 'Bubble map',
    description: 'An interactive, clustered map for non-linear exploration',
    active: true,
    contentType: 'both',
    Cover: BubbleMapCover,
  },
]
