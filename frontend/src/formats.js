import TimelineCover from './covers/TimelineCover'
import BubbleMapCover from './covers/BubbleMapCover'
import GalleryCover from './covers/GalleryCover'

export const formats = [
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Slides as an interactive horizontal timeline',
    active: true,
    Cover: TimelineCover,
  },
  {
    id: 'gallery',
    label: 'Gallery',
    description: 'Slides as a Pinterest-style masonry grid of photo cards',
    active: true,
    Cover: GalleryCover,
  },
  {
    id: 'bubble-map',
    label: 'Bubble map',
    description: 'Topics as an interactive cluster map',
    active: true,
    Cover: BubbleMapCover,
  },
]
