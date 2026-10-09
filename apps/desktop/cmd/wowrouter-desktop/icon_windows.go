//go:build windows

package main

import "encoding/binary"

func trayIcon() []byte {
	const n = 16
	xor := make([]byte, 0, n*n*4)
	for i := 0; i < n*n; i++ {
		xor = append(xor, 0x4F, 0x46, 0xE8, 0xFF)
	}
	and := make([]byte, n*((n+31)/32)*4)
	header := make([]byte, 40)
	binary.LittleEndian.PutUint32(header[0:], 40)
	binary.LittleEndian.PutUint32(header[4:], n)
	binary.LittleEndian.PutUint32(header[8:], n*2)
	binary.LittleEndian.PutUint16(header[12:], 1)
	binary.LittleEndian.PutUint16(header[14:], 32)
	binary.LittleEndian.PutUint32(header[20:], uint32(len(xor)+len(and)))
	image := append(header, xor...)
	image = append(image, and...)

	blob := make([]byte, 22+len(image))
	binary.LittleEndian.PutUint16(blob[2:], 1)
	binary.LittleEndian.PutUint16(blob[4:], 1)
	blob[6] = n
	blob[7] = n
	binary.LittleEndian.PutUint16(blob[10:], 1)
	binary.LittleEndian.PutUint16(blob[12:], 32)
	binary.LittleEndian.PutUint32(blob[14:], uint32(len(image)))
	binary.LittleEndian.PutUint32(blob[18:], 22)
	copy(blob[22:], image)
	return blob
}
