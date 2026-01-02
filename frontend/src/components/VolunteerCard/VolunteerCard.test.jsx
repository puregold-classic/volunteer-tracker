import { render, screen } from '@testing-library/react'
import VolunteerCard from './VolunteerCard'

describe('VolunteerCard', () => {
it('renders correctly', () => {
render(<VolunteerCard />)
expect(screen.getByText('VolunteerCard Component')).toBeInTheDocument()
})
})
