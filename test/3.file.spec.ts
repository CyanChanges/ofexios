import fexios from '../src/index'
import { describe, it } from 'mocha'
import { expect } from 'chai'
import { File } from '@web-std/file'
import { EchoResponse } from './MockData'
import { ECHO_BASE_URL } from './constants'

// create a fake png file with 1x1 pixel
const fileName = 'test.png'
const fileBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mMAAQAABQABoIJXOQAAAABJRU5ErkJggg=='
const fileDataURL = `data:image/png;base64,${fileBase64}`
const fileFile = dataURLtoFile(fileDataURL, fileName)

function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)![1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  // eslint-disable-next-line no-plusplus
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

describe('Fexios File Uploads', () => {
  it('Upload file directly', async () => {
    const { data } = await fexios.post<EchoResponse>(
      `${ECHO_BASE_URL}/post`,
      fileFile
    )

    const fileInfo = data.binaryFiles?.[0]!
    expect(fileInfo).not.to.be.undefined
    expect(fileInfo.type).to.equal('image/png')
    expect(fileInfo.dataURL).to.equal(fileDataURL)
  })

  it('Upload file with Form', async () => {
    const form = new FormData()
    form.append(fileName, fileFile)

    const { data } = await fexios.post<EchoResponse>(
      `${ECHO_BASE_URL}/post`,
      form
    )

    expect(data.binaryFiles?.[0]?.name).to.equal(fileName)
  })
})
