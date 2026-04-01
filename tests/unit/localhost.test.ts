describe('Localhost Binding', () => {
  const localhostPattern = /^(127\.0\.0\.1|::1|localhost)$/i

  it('should accept 127.0.0.1', () => {
    expect(localhostPattern.test('127.0.0.1')).toBe(true)
  })

  it('should accept ::1', () => {
    expect(localhostPattern.test('::1')).toBe(true)
  })

  it('should accept localhost', () => {
    expect(localhostPattern.test('localhost')).toBe(true)
  })

  it('should accept LOCALHOST (case insensitive)', () => {
    expect(localhostPattern.test('LOCALHOST')).toBe(true)
  })

  it('should reject 0.0.0.0', () => {
    expect(localhostPattern.test('0.0.0.0')).toBe(false)
  })

  it('should reject external IP', () => {
    expect(localhostPattern.test('192.168.1.1')).toBe(false)
  })

  it('should reject public IP', () => {
    expect(localhostPattern.test('8.8.8.8')).toBe(false)
  })

  it('should reject domain name', () => {
    expect(localhostPattern.test('example.com')).toBe(false)
  })

  it('should reject :: (all interfaces IPv6)', () => {
    expect(localhostPattern.test('::')).toBe(false)
  })
})
