stack = []  # 리스트 생성 for 스택
import sys
input = sys.stdin.readline  

for _ in range(int(input())):  # 입력된 명령의 수만큼 반복
    command = input().split()  # 명령어와 값을 분리

    if command[0] == 'push':  # push 명령이면 정수를 스택에 추가
        stack.append(int(command[1]))
    elif command[0] == 'pop':  # pop 명령이면 스택의 맨 위 값을 꺼냄
        print(stack.pop() if stack else -1)
    elif command[0] == 'size':  # size 명령이면 스택의 크기를 출력
        print(len(stack))
    elif command[0] == 'empty':  # empty 명령이면 스택이 비어있는지 확인
        print(0 if stack else 1)
    elif command[0] == 'top':  # top 명령이면 스택의 맨 위 값을 확인
        print(stack[-1] if stack else -1)