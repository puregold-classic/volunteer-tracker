import React from 'react'
import PropTypes from 'prop-types'
import './VolunteerCard.scss'

const VolunteerCard = ({ data, onAction }) => {
return (
<div className="VolunteerCard">
<h3>VolunteerCard Component</h3>
<p>Component implementation goes here</p>
</div>
)
}

VolunteerCard.propTypes = {
data: PropTypes.object,
onAction: PropTypes.func
}

VolunteerCard.defaultProps = {
data: {},
onAction: () => {}
}

export default VolunteerCard
