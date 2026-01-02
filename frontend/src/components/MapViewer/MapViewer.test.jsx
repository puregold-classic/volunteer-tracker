import { render, screen } from '@testing-library/react'
import MapViewer from './MapViewer'

describe('MapViewer', () => {
it('renders correctly', () => {
render(<MapViewer />)
expect(screen.getByText('MapViewer Component')).toBeInTheDocument()
})
})
