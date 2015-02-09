
###*
# Returns a chopped up document that's easy to parse.
#
# @param {string} The full document
# @return {Array.<string>} A list of all slides
###

slice = (document) ->
  cuts = document.split(/\n(?=\-\-)/)
  slices = []
  nlIndex = undefined
  i = 0
  while i < cuts.length

    ###*
    # The first slide does not get the following treatment, so we just
    # add it as content.
    #
    # Otherwise, we slice off the `--` at the beginning.
    ###

    if !cuts[i].match(/^--/)
      slices.push content: cuts[i].trim()
      i++
      continue
    else

      ### If we leave out options, add an empty slide at the beginning ###

      if i == 0
        slices.push content: ''
      cuts[i] = cuts[i].slice(2)

    ###*
    # Slices at this point will contain class names, followed by several
    # newlines
    ###

    nlIndex = cuts[i].indexOf('\n')
    if nlIndex == -1
      # Just to be safe...
      nlIndex = 0

    ### Push the classList and markdown content ###

    slices.push
      classList: cuts[i].slice(0, nlIndex)
      content: cuts[i].slice(nlIndex).trim()
    i++
  slices

exports.slice = slice
