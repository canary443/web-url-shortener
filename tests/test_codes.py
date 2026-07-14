from api._lib import codes


def test_code_length():
    assert len(codes.new_code()) == codes.CODE_LENGTH


def test_code_alphabet():
    code = codes.new_code()
    assert all(ch in codes.ALPHABET for ch in code)


def test_codes_vary():
    # collisions in 200 draws would mean something is very wrong
    generated = {codes.new_code() for _ in range(200)}
    assert len(generated) > 190
