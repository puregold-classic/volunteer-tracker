import React from 'react'
import PropTypes from 'prop-types'
import './RegionPanel.scss'

const RegionPanel = ({ data, onAction }) => {
return (
<div className="RegionPanel">
<h3>RegionPanel Component</h3>
<p>Component implementation goes here</p>
</div>
)
}

RegionPanel.propTypes = {
data: PropTypes.object,
onAction: PropTypes.func
}

RegionPanel.defaultProps = {
data: {},
onAction: () => {}
}

export default RegionPanel
