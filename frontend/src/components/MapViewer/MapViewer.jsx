import React from 'react'
import PropTypes from 'prop-types'
import './MapViewer.scss'

const MapViewer = ({ data, onAction }) => {
return (
<div className="MapViewer">
<h3>MapViewer Component</h3>
<p>Component implementation goes here</p>
</div>
)
}

MapViewer.propTypes = {
data: PropTypes.object,
onAction: PropTypes.func
}

MapViewer.defaultProps = {
data: {},
onAction: () => {}
}

export default MapViewer
